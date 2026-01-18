import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Card, useThemeColor } from "heroui-native";
import { useEffect, useState, useCallback } from "react";
import { Text, View, Pressable, PressableStateCallbackType, FlatList, ActivityIndicator, RefreshControl } from "react-native";
import { useFocusEffect } from "expo-router";

import { Container } from "@/components/container";
import { authClient } from "@/lib/auth-client";
import { localDb } from "@/lib/local-db";
import { getDeviceId } from "@/lib/device-storage";
import { trpcClient } from "@/utils/trpc";

interface Conversation {
  deviceId: string;
  deviceName: string;
  lastMessage: string;
  lastTimestamp: number;
  unreadCount: number;
}

export default function MessagesListScreen() {
  const { data: session } = authClient.useSession();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [focusedConvo, setFocusedConvo] = useState<string | null>(null);
  const [pairFocused, setPairFocused] = React.useState(false);
  const iconColor = "#7C3AED";
  const themeColorForeground = useThemeColor("foreground");
  const themeColorMuted = useThemeColor("muted");

  const getConvoFocusStyle = (deviceId: string) => ({ pressed }: PressableStateCallbackType) => ({
    opacity: pressed ? 0.7 : focusedConvo === deviceId ? 0.8 : 1,
    backgroundColor: focusedConvo === deviceId ? "#7C3AED20" : "transparent",
    borderRadius: 12,
  });

  const pairFocusStyle = ({ pressed }: PressableStateCallbackType) => ({
    opacity: pressed ? 0.7 : pairFocused ? 0.8 : 1,
    backgroundColor: pairFocused ? "#7C3AED20" : "transparent",
    borderRadius: 8,
  });

  // Initialize local database
  useEffect(() => {
    localDb.init().then(() => {
      console.log("[messages-list] Local database initialized");
    });
  }, []);

  // Load conversations
  const loadConversations = async () => {
    try {
      setLoading(true);
      const localConvos = await localDb.getConversations();
      const localConvoMap = new Map(localConvos.map(c => [c.conversationId, c]));

      // Fetch all devices to find paired ones
      const devices = await trpcClient.device.list.query();
      const currentDeviceId = await getDeviceId();
      
      // Filter for devices that have a public key (are paired) and are NOT this device
      const pairedDevices = devices.filter((d: any) => d.publicKey !== null && d.id !== currentDeviceId);

      const enrichedConvos: Conversation[] = pairedDevices.map((device: any) => {
        const localInfo = localConvoMap.get(device.id);
        return {
          deviceId: device.id,
          deviceName: device.name,
          lastMessage: localInfo?.lastMessage || "No messages yet",
          lastTimestamp: localInfo?.lastTimestamp || (device.createdAt ? new Date(device.createdAt).getTime() : Date.now()),
          unreadCount: localInfo?.unreadCount || 0,
        };
      });

      // Sort by timestamp
      enrichedConvos.sort((a, b) => b.lastTimestamp - a.lastTimestamp);

      setConversations(enrichedConvos);
    } catch (error) {
      console.error("[messages-list] Failed to load conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (session?.user) {
        loadConversations();
      }
    }, [session?.user])
  );

  const onRefresh = useCallback(() => {
    loadConversations();
  }, []);

  const formatTimestamp = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const renderConversation = ({ item }: { item: Conversation }) => (
    <Pressable
      className="mb-3"
      style={getConvoFocusStyle(item.deviceId)}
      onPress={() => {
        router.push({
          pathname: "/(drawer)/messages/chat",
          params: { deviceId: item.deviceId, deviceName: item.deviceName },
        } as any);
      }}
      onFocus={() => setFocusedConvo(item.deviceId)}
      onBlur={() => setFocusedConvo(null)}
      accessibilityLabel={`Conversation with ${item.deviceName}, ${item.unreadCount > 0 ? item.unreadCount + ' unread messages' : 'no unread messages'}`}
      accessibilityRole="button"
    >
      <Card variant="secondary" className="p-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <View className="flex-row items-center gap-2 mb-1">
              <Text className="text-lg font-semibold text-foreground">
                {item.deviceName}
              </Text>
              {item.unreadCount > 0 && (
                <View className="bg-[#7C3AED] rounded-full px-2 py-0.5">
                  <Text className="text-xs text-white font-bold">
                    {item.unreadCount}
                  </Text>
                </View>
              )}
            </View>
            <Text
              className="text-sm text-muted"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {item.lastMessage}
            </Text>
          </View>
          <View className="items-end gap-1">
            <Text className="text-xs text-muted">
              {formatTimestamp(item.lastTimestamp)}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={themeColorMuted}
            />
          </View>
        </View>
      </Card>
    </Pressable>
  );

  if (loading) {
    return (
      <Container scrollable={false} className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={iconColor} />
        <Text className="text-muted mt-4">Loading conversations...</Text>
      </Container>
    );
  }

  return (
    <Container scrollable={false} className="flex-1 p-4">
      {conversations.length === 0 ? (

        <View className="flex-1 items-center justify-center gap-4">
          <Ionicons name="chatbubbles-outline" size={64} color={iconColor} />
          <Text className="text-xl font-semibold text-foreground">
            No Messages Yet
          </Text>
          <Text className="text-sm text-muted text-center px-8">
            Pair your device and start sending encrypted messages
          </Text>
          <Pressable
            className="mt-4"
            style={pairFocusStyle}
            onPress={() => {
              router.push("/(drawer)/pairing" as any);
            }}
            onFocus={() => setPairFocused(true)}
            onBlur={() => setPairFocused(false)}
            accessibilityLabel="Pair Device, connect a new device"
            accessibilityRole="button"
          >
            <Card variant="secondary" className="px-6 py-3">
              <Text className="text-[#7C3AED] font-semibold">Pair Device</Text>
            </Card>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.deviceId}
          renderItem={renderConversation}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={onRefresh}
              tintColor={iconColor}
              colors={[iconColor]}
            />
          }
        />
      )}
    </Container>
  );
}
