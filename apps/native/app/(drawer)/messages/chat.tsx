import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { Card, useThemeColor } from "heroui-native";
import { useEffect, useState, useRef } from "react";
import {
  Text,
  View,
  TextInput,
  Pressable,
  PressableStateCallbackType,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";

import { Container } from "@/components/container";
import { authClient } from "@/lib/auth-client";
import { localDb, type LocalMessage } from "@/lib/local-db";
import { getDeviceId } from "@/lib/device-storage";
import { sendEncryptedMessage, decryptReceivedMessage } from "@/lib/messaging";
import { trpcClient } from "@/utils/trpc";

export default function ChatScreen() {
  const { data: session } = authClient.useSession();
  const params = useLocalSearchParams();
  const recipientDeviceId = params.deviceId as string;
  const recipientDeviceName = params.deviceName as string;
  const { top: topInset } = useSafeAreaInsets();

  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sendFocused, setSendFocused] = React.useState(false);
  const flatListRef = useRef<FlatList>(null);

  const iconColor = "#7C3AED";
  const themeColorForeground = useThemeColor("foreground");
  const themeColorMuted = useThemeColor("muted");
  const themeColorBackground = useThemeColor("background");

  const sendFocusStyle = ({ pressed }: PressableStateCallbackType) => ({
    opacity: pressed ? 0.7 : sendFocused ? 0.8 : 1,
    backgroundColor: sendFocused && inputText.trim() && !sending ? "#6D28D9" : undefined,
  });

  // Initialize local database
  useEffect(() => {
    localDb.init().then(() => {
      console.log("[chat] Local database initialized");
    });
  }, []);

  // Load messages for this conversation
  const loadMessages = async () => {
    try {
      setLoading(true);
      const conversationMessages = await localDb.getConversationMessages(
        recipientDeviceId
      );
      setMessages(conversationMessages.reverse()); // Reverse to show oldest first
    } catch (error) {
      console.error("[chat] Failed to load messages:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user && recipientDeviceId) {
      loadMessages();
      // Mark conversation as read
      localDb.markConversationAsRead(recipientDeviceId);
      
      // Notify server
      getDeviceId().then(deviceId => {
        if (deviceId) {
          trpcClient.message.markConversationRead.mutate({
            deviceId,
            conversationId: recipientDeviceId,
          });
        }
      });
    }
  }, [session?.user, recipientDeviceId]);

  // Subscribe to new messages and status updates
  useEffect(() => {
    if (!session?.user) return;

    const initMessageSubscription = async () => {
      const deviceId = await getDeviceId();
      if (!deviceId) return;

      // Try to get last message ID for reconnection
      const lastMessageId = await SecureStore.getItemAsync(`lastMessageId_${deviceId}`);

      const subscription = trpcClient.message.onMessage.subscribe(
        { 
          deviceId,
          lastEventId: lastMessageId || undefined,
        },
        {
          onData(event) {
            const eventType = event.data?.type;
            
            // Handle incoming messages
            if (eventType === "message:received") {
              const msg = event.data?.message;
              if (!msg || msg.senderDeviceId !== recipientDeviceId) return;

              // Decrypt and store the message
              decryptReceivedMessage(
                msg.id,
                msg.senderDeviceId,
                msg.encryptedContent,
                deviceId,
                new Date(msg.sentAt).getTime()
              ).then(async (content) => {
                // Store this message ID for future reconnections
                await SecureStore.setItemAsync(`lastMessageId_${deviceId}`, msg.id);

                // Add message to state directly instead of reloading
                const newMessage = createLocalMessageFromReceived(
                  msg.id,
                  msg.senderDeviceId,
                  content,
                  msg.encryptedContent,
                  new Date(msg.sentAt).getTime()
                );
                addMessageToState(newMessage);

                // Send delivery receipt
                trpcClient.message.updateStatus.mutate({
                  messageId: msg.id,
                  status: "delivered",
                });
              });
            }
            
            // Handle status updates
            else if (eventType === "message:status_updated") {
              const { messageId, status } = event.data as any;
              if (messageId) {
                // Update local message status in database
                localDb.updateMessageStatus(messageId, status).then(() => {
                  // Update message status in state directly instead of reloading
                  updateMessageStatusInState(messageId, status);
                });
              }
            }
          },
          onError(err) {
            console.error("[chat] Message subscription error:", err);
          },
        }
      );

      return () => {
        subscription.unsubscribe();
      };
    };

    const cleanup = initMessageSubscription();
    return () => {
      cleanup.then((fn) => fn?.());
    };
  }, [session?.user, recipientDeviceId]);

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;

    const deviceId = await getDeviceId();
    if (!deviceId) {
      console.error("[chat] No device ID found");
      return;
    }

    setSending(true);
    const messageContent = inputText.trim();
    setInputText(""); // Clear input immediately

    try {
      const result = await sendEncryptedMessage(deviceId, recipientDeviceId, messageContent);

      // Get the saved message from database to add to state immediately
      const savedMessage = await localDb.getMessage(result.id);
      if (savedMessage) {
        addMessageToState(savedMessage);
      }

      // Success feedback
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error("[chat] Failed to send message:", error);
      // Restore input text on error
      setInputText(messageContent);
    } finally {
      setSending(false);
    }
  };

  // Helper functions for optimized state management
  const addMessageToState = (newMessage: LocalMessage) => {
    setMessages(prev => {
      // Check if message already exists to avoid duplicates
      if (prev.some(msg => msg.id === newMessage.id)) {
        return prev;
      }
      return [...prev, newMessage];
    });
  };

  const updateMessageStatusInState = (messageId: string, newStatus: "pending" | "sent" | "delivered" | "read") => {
    setMessages(prev => 
      prev.map(msg => 
        msg.id === messageId ? { ...msg, status: newStatus } : msg
      )
    );
  };

  const createLocalMessageFromReceived = (
    messageId: string,
    senderDeviceId: string,
    content: string,
    encryptedContent: string,
    timestamp: number
  ): LocalMessage => ({
    id: messageId,
    conversationId: senderDeviceId,
    content,
    encryptedContent,
    isSent: false,
    status: "delivered",
    timestamp,
    contentType: "text",
  });

  const createLocalMessageFromSent = (
    messageId: string,
    content: string,
    encryptedContent: string,
    status: "pending" | "sent" | "delivered" | "read",
    timestamp: number
  ): LocalMessage => ({
    id: messageId,
    conversationId: recipientDeviceId,
    content,
    encryptedContent,
    isSent: true,
    status,
    timestamp,
    contentType: "text",
  });

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const renderMessage = ({ item }: { item: LocalMessage }) => (
    <View
      className={`mb-3 ${item.isSent ? "items-end" : "items-start"}`}
      key={item.id}
    >
      <View
        className={`max-w-[75%] rounded-2xl px-4 py-2 ${
          item.isSent ? "bg-[#7C3AED]" : "bg-gray-200 dark:bg-gray-700"
        }`}
      >
        <Text
          className={`text-base ${item.isSent ? "text-white" : "text-foreground"}`}
        >
          {item.content}
        </Text>
      </View>
      <View className="flex-row items-center gap-1 mt-1 px-1">
        <Text className="text-xs text-muted">
          {formatTimestamp(item.timestamp)}
        </Text>
        {item.isSent && (
          <Ionicons
            name={
              item.status === "read"
                ? "checkmark-done"
                : item.status === "delivered"
                  ? "checkmark-done"
                  : item.status === "sent"
                    ? "checkmark"
                    : "time-outline"
            }
            size={12}
            color={item.status === "read" ? iconColor : themeColorMuted}
          />
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <Container scrollable={false} className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={iconColor} />
        <Text className="text-muted mt-4">Loading messages…</Text>
      </Container>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: recipientDeviceName,
          headerBackTitle: "Messages",
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
        keyboardVerticalOffset={Platform.OS === "ios" ? topInset + 56 : 0}
      >
        <Container scrollable={false} className="flex-1">
          {/* Messages list */}
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerClassName="p-4"
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            windowSize={10}
            onContentSizeChange={() => {
              flatListRef.current?.scrollToEnd({ animated: false });
            }}
          />

          {/* Input area */}
          <View
            className="border-t border-gray-200 dark:border-gray-700 p-4"
            style={{ backgroundColor: themeColorBackground }}
          >
            <View className="flex-row items-center gap-2">
              <View className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full px-4 py-2">
                <TextInput
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder="Type a message..."
                  placeholderTextColor={themeColorMuted}
                  className="text-base text-foreground"
                  multiline
                  maxLength={1000}
                  editable={!sending}
                  onSubmitEditing={handleSend}
                  blurOnSubmit={false}
                  accessibilityLabel="Message input"
                />
              </View>
              <Pressable
                onPress={handleSend}
                disabled={!inputText.trim() || sending}
                style={sendFocusStyle}
                className={`w-12 h-12 rounded-full items-center justify-center ${
                  inputText.trim() && !sending
                    ? "bg-[#7C3AED]"
                    : "bg-gray-300 dark:bg-gray-700"
                }`}
                onFocus={() => setSendFocused(true)}
                onBlur={() => setSendFocused(false)}
                accessibilityLabel="Send message"
                accessibilityRole="button"
                accessibilityState={{ disabled: !inputText.trim() || sending }}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Ionicons
                    name="send"
                    size={20}
                    color={inputText.trim() ? "white" : themeColorMuted}
                  />
                )}
              </Pressable>
            </View>
          </View>
        </Container>
      </KeyboardAvoidingView>
    </>
  );
}
