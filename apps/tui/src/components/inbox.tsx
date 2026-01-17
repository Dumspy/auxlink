import { useState, useEffect } from "react";
import { getDeviceId } from "@/lib/device-storage";
import { localDb, type LocalMessage } from "@/lib/local-db";
import { trpc } from "@/utils/trpc";
import { decryptReceivedMessage, sendEncryptedMessage } from "@/lib/messaging";
import { storage } from "@/lib/storage";
import { setInputFieldFocus } from "../index";

interface InboxProps {
  onBack: () => void;
  onNavigationChange: (handlers: {
    onArrowUp: () => void;
    onArrowDown: () => void;
    onKeyPress: (key: string) => void;
  }) => void;
}

export function Inbox({ onBack, onNavigationChange }: InboxProps) {
  const [conversations, setConversations] = useState<
    Array<{
      deviceId: string;
      deviceName: string;
      lastMessage: string;
      lastTimestamp: number;
      unreadCount: number;
    }>
  >([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "conversation">("list");
  const [currentConversation, setCurrentConversation] = useState<{
    deviceId: string;
    deviceName: string;
    messages: LocalMessage[];
  } | null>(null);
  const [messageScrollIndex, setMessageScrollIndex] = useState(0);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  // Initialize local database
  useEffect(() => {
    localDb.init();
    loadConversations();
  }, []);

  // Subscribe to new messages
  useEffect(() => {
    const setupSubscription = async () => {
      const deviceId = await getDeviceId();
      if (!deviceId) return;

      const lastMessageId = await storage.getItem(`lastMessageId:${deviceId}`);

      try {
        const subscription = trpc.message.onMessage.subscribe(
          {
            deviceId,
            lastEventId: lastMessageId || undefined,
          },
          {
            async onData(event: any) {
              if (event?.code || event?.data?.code) return;

              const eventType = event?.data?.type;

              // Handle incoming messages
              if (eventType === "message:received") {
                const msg = event?.data?.message;
                if (!msg || !msg.senderDeviceId || !msg.encryptedContent) return;

                // Store message ID for reconnection
                await storage.setItem(`lastMessageId:${deviceId}`, msg.id);

                // Decrypt and store
                await decryptReceivedMessage(
                  msg.id,
                  msg.senderDeviceId,
                  msg.encryptedContent,
                  deviceId,
                  new Date(msg.sentAt).getTime()
                );

                // Send delivery receipt
                await trpc.message.updateStatus.mutate({
                  messageId: msg.id,
                  status: "delivered",
                });

                // Reload conversations if in list view
                if (viewMode === "list") {
                  loadConversations();
                } else if (
                  currentConversation &&
                  msg.senderDeviceId === currentConversation.deviceId
                ) {
                  // Reload current conversation
                  loadConversationMessages(currentConversation.deviceId);
                }
              }
              
              // Handle status updates
              else if (eventType === "message:status_updated") {
                const { messageId, status } = event.data as any;
                if (messageId) {
                  // Update local message status
                  localDb.updateMessageStatus(messageId, status);
                  
                  // Reload current conversation if viewing it
                  if (viewMode === "conversation" && currentConversation) {
                    loadConversationMessages(currentConversation.deviceId);
                  }
                }
              }
            },
            onError(err: any) {
              console.error("[inbox] Subscription error:", err);
            },
          }
        );

        return () => {
          subscription.unsubscribe();
        };
      } catch (error: any) {
        console.error("[inbox] Failed to create subscription:", error);
      }
    };

    setupSubscription();
  }, [viewMode, currentConversation]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      if (!(localDb as any).db) localDb.init();
      const localConvos = localDb.getConversations();
      const localConvoMap = new Map(localConvos.map(c => [c.conversationId, c]));

      // Fetch all devices to find paired ones
      const devices = await trpc.device.list.query();
      const currentDeviceId = await getDeviceId();
      
      // Filter for devices that have a public key (are paired) and are NOT this device
      const pairedDevices = devices.filter((d: any) => d.publicKey !== null && d.id !== currentDeviceId);

      const enrichedConvos = pairedDevices.map((device: any) => {
        const localInfo = localConvoMap.get(device.id);
        const createdAt = device.createdAt ? new Date(device.createdAt).getTime() : Date.now();
        return {
          deviceId: device.id,
          deviceName: device.name,
          lastMessage: localInfo?.lastMessage || "No messages yet",
          lastTimestamp: localInfo?.lastTimestamp || createdAt,
          unreadCount: localInfo?.unreadCount || 0,
        };
      });

      // Sort by timestamp
      enrichedConvos.sort((a, b) => b.lastTimestamp - a.lastTimestamp);

      setConversations(enrichedConvos);
    } catch (error) {
      console.error("[inbox] Failed to load conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadConversationMessages = async (deviceId: string) => {
    try {
      const messages = localDb.getConversationMessages(deviceId);
      const devices = await trpc.device.list.query();
      const device = devices.find((d: any) => d.id === deviceId);

      setCurrentConversation({
        deviceId,
        deviceName: device?.name || "Unknown Device",
        messages: messages.reverse(), // Show oldest first
      });

      // Mark as read
      localDb.markConversationAsRead(deviceId);

      // Notify server
      const localDeviceId = await getDeviceId();
      if (localDeviceId) {
        trpc.message.markConversationRead.mutate({
          deviceId: localDeviceId,
          conversationId: deviceId,
        });
      }

      setMessageScrollIndex(messages.length - 1); // Start at bottom
      setViewMode("conversation");
    } catch (error) {
      console.error("[inbox] Failed to load messages:", error);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !currentConversation) return;

    const deviceId = await getDeviceId();
    if (!deviceId) return;

    try {
      await sendEncryptedMessage(deviceId, currentConversation.deviceId, inputText.trim());
      setInputText("");
      setIsTyping(false);
      setInputFieldFocus(false);
      loadConversationMessages(currentConversation.deviceId);
    } catch (error) {
      console.error("[inbox] Failed to send message:", error);
    }
  };

  // Navigation handlers
  useEffect(() => {
    if (viewMode === "list") {
      onNavigationChange({
        onArrowUp: () => {
          setSelectedIndex((prev) => Math.max(0, prev - 1));
        },
        onArrowDown: () => {
          setSelectedIndex((prev) =>
            Math.min(conversations.length - 1, prev + 1)
          );
        },
        onKeyPress: (key: string) => {
          if (key === "\r" && conversations.length > 0) {
            // Enter - open conversation
            const convo = conversations[selectedIndex];
            if (convo) {
              loadConversationMessages(convo.deviceId);
            }
          } else if (key === "b" || key === "B" || key === "q" || key === "Q") {
            // Back to menu
            setIsTyping(false);
            setInputFieldFocus(false);
            onBack();
          } else if (key === "r" || key === "R") {
            // Refresh
            loadConversations();
          }
        },
      });
    } else if (viewMode === "conversation") {
      onNavigationChange({
        onArrowUp: () => {
          if (isTyping) return;
          setMessageScrollIndex((prev) =>
            Math.max(0, prev - 1)
          );
        },
        onArrowDown: () => {
          if (isTyping) return;
          const maxIndex = currentConversation ? currentConversation.messages.length - 1 : 0;
          setMessageScrollIndex((prev) =>
            Math.min(maxIndex, prev + 1)
          );
        },
        onKeyPress: (key: string) => {
          if (isTyping) {
            if (key === "\r") {
              handleSendMessage();
            } else if (key === "\x1b") { // Escape
              setIsTyping(false);
              setInputFieldFocus(false);
            } else if (key === "\x7f" || key === "\b") { // Backspace
              setInputText(prev => (prev.length > 0 ? prev.slice(0, -1) : prev));
            } else if (key.length === 1 && key !== "\r" && key !== "\n" && key !== "\x1b" && key !== "\x7f" && key !== "\t") {
              setInputText(prev => prev + key);
            }
            return;
          }

          if (key === "b" || key === "B" || key === "q" || key === "Q") {
            // Back to list
            setIsTyping(false);
            setInputFieldFocus(false);
            setViewMode("list");
            setCurrentConversation(null);
            loadConversations();
          } else if (key === "t" || key === "T" || key === "r" || key === "R" || key === "\r") {
            // Start typing / Reply
            setIsTyping(true);
            setInputFieldFocus(true);
          }
        },
      });
    }
  }, [viewMode, selectedIndex, conversations, currentConversation, messageScrollIndex, isTyping, inputText, onNavigationChange]);

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const formatRelativeTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "now";
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return new Date(timestamp).toLocaleDateString();
  };

  if (loading) {
    return (
      <box
        style={{
          flexDirection: "column",
          gap: 1,
          alignItems: "center",
          alignSelf: "center",
        }}
      >
        <text fg="#7C3AED">{"⏳ Loading messages..."}</text>
      </box>
    );
  }

  // Conversation view
  if (viewMode === "conversation" && currentConversation) {
    const visibleMessages = currentConversation.messages.slice(
      Math.max(0, messageScrollIndex - 5),
      messageScrollIndex + 6
    );

    return (
      <box
        style={{
          flexDirection: "column",
          gap: 1,
          minWidth: 60,
          alignItems: "center",
          alignSelf: "center",
        }}
      >
        <text fg="#7C3AED">{`${currentConversation.deviceName}`}</text>
        <text></text>

        <box style={{ flexDirection: "column", gap: 0, alignItems: "flex-start" }}>
          {visibleMessages.map((msg, index) => {
            const line = `${msg.isSent ? "→ " : "← "}${formatTimestamp(msg.timestamp)} ${msg.content}`;
            return (
              <text key={msg.id} fg={msg.isSent ? "#7C3AED" : "#FFFFFF"}>
                {line}
              </text>
            );
          })}
        </box>

        <text></text>
        <box style={{ flexDirection: "row", gap: 1 }}>
          <text fg={isTyping ? "#7C3AED" : "#666"}>{`${isTyping ? "❯ " : "[T] Reply: "}`}</text>
          <text fg="#FFFFFF">{`${inputText}${isTyping ? "_" : ""}`}</text>
        </box>
        <text></text>
        <text fg="#666">{`${isTyping ? "Enter Send • Esc Cancel" : "[B] Back • ↑↓ Scroll • [T] Reply"}`}</text>
      </box>
    );
  }

  // Conversations list view
  return (
    <box
      style={{
        flexDirection: "column",
        gap: 1,
        minWidth: 50,
        alignItems: "center",
        alignSelf: "center",
      }}
    >
      <text fg="#7C3AED">Inbox</text>
      <text></text>

      {conversations.length === 0 ? (
        <>
          <text fg="#888">{"No messages yet"}</text>
          <text></text>
          <text fg="#666">{"Pair a device to start messaging"}</text>
        </>
      ) : (
        <>
          <box style={{ flexDirection: "column", gap: 0, alignItems: "flex-start" }}>
            {conversations.map((convo, index) => {
              const label = `${index === selectedIndex ? "▶ " : "  "}${convo.deviceName} ${convo.unreadCount > 0 ? `(${convo.unreadCount})` : ""} - ${convo.lastMessage.substring(0, 30)}${convo.lastMessage.length > 30 ? "..." : ""} ${formatRelativeTime(convo.lastTimestamp)}`;
              return (
                <text key={convo.deviceId} fg={index === selectedIndex ? "#7C3AED" : "#FFFFFF"}>
                  {label}
                </text>
              );
            })}
          </box>
          <text></text>
          <text fg="#666">{"↑↓ Navigate • Enter Open • [R] Refresh • [B] Back"}</text>
        </>
      )}
    </box>
  );
}
