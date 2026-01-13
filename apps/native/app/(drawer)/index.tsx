import { Ionicons } from "@expo/vector-icons";
import { Redirect, router } from "expo-router";
import { Card, useThemeColor } from "heroui-native";
import { useEffect } from "react";
import { Text, View, Pressable } from "react-native";
import * as Device from "expo-device";

import { Container } from "@/components/container";
import { authClient } from "@/lib/auth-client";
import { trpcClient } from "@/utils/trpc";
import { getDeviceId, storeDeviceId } from "@/lib/device-storage";

export default function Home() {
  const { data: session } = authClient.useSession();
  const iconColor = "#7C3AED";

  // Device registration - runs after auth is confirmed
  useEffect(() => {
    const initializeDevice = async () => {
      if (!session?.user) {
        return;
      }

      try {
        const storedDeviceId = await getDeviceId();
        const userAgent = `${Device.osName} ${Device.osVersion} (${Device.modelName})`;

        if (storedDeviceId) {
          await trpcClient.device.updateLastSeen.mutate({ deviceId: storedDeviceId });
        } else {
          const device = await trpcClient.device.register.mutate({
            deviceType: "mobile",
            userAgent,
          });
          await storeDeviceId(device.id);
        }
      } catch (error) {
        console.error("[device-registration] Silent failure:", error);
      }
    };

    initializeDevice();
  }, [session?.user]);

  if (!session?.user) {
    return <Redirect href="/(auth)/welcome" />;
  }

  return (
    <Container className="p-6">
      <View className="mb-8">
        <Text className="text-4xl font-bold mb-2 text-foreground">
          Aux<Text style={{ color: "#7C3AED" }}>Link</Text>
        </Text>
        <Text className="text-base text-muted">
          Welcome, <Text className="font-semibold text-[#7C3AED]">{session.user.name}</Text>
        </Text>
      </View>

      {/* Quick action cards */}
      <View className="gap-4">
        <Pressable
          className="w-full active:opacity-70"
          onPress={() => {
            // TODO: Navigate to messages screen (Phase 4)
          }}
        >
          <Card variant="secondary" className="p-6">
            <View className="items-center gap-3">
              <Ionicons name="chatbubble-outline" size={32} color={iconColor} />
              <Text className="text-xl font-semibold text-foreground">Messages</Text>
              <Text className="text-sm text-muted text-center">View your encrypted messages</Text>
            </View>
          </Card>
        </Pressable>

        <Pressable
          className="w-full active:opacity-70"
          onPress={() => {
            // TODO: Navigate to pairing screen (Phase 3)
          }}
        >
          <Card variant="secondary" className="p-6">
            <View className="items-center gap-3">
              <Ionicons name="qr-code-outline" size={32} color={iconColor} />
              <Text className="text-xl font-semibold text-foreground">Pair Device</Text>
              <Text className="text-sm text-muted text-center">Connect to desktop app</Text>
            </View>
          </Card>
        </Pressable>

        <Pressable
          className="w-full active:opacity-70"
          onPress={() => {
            router.push("/(drawer)/settings" as any);
          }}
        >
          <Card variant="secondary" className="p-6">
            <View className="items-center gap-3">
              <Ionicons name="settings-outline" size={32} color={iconColor} />
              <Text className="text-xl font-semibold text-foreground">Settings</Text>
              <Text className="text-sm text-muted text-center">Manage your account</Text>
            </View>
          </Card>
        </Pressable>
      </View>
    </Container>
  );
}


