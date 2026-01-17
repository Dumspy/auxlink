import { Ionicons } from "@expo/vector-icons";
import { Redirect, router } from "expo-router";
import { Card, useThemeColor } from "heroui-native";
import { useEffect, useState } from "react";
import { Text, View, Pressable } from "react-native";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";

import { Container } from "@/components/container";
import { authClient } from "@/lib/auth-client";
import { trpcClient } from "@/utils/trpc";
import { isTRPCNotFoundError } from "@auxlink/api/utils/error";
import {
  getDeviceId,
  storeDeviceId,
  clearDeviceId,
} from "@/lib/device-storage";
import { localDb } from "@/lib/local-db";
import { decryptReceivedMessage } from "@/lib/messaging";

export default function Home() {
  const { data: session } = authClient.useSession();
  const iconColor = "#7C3AED";

  // Initialize local database
  useEffect(() => {
    localDb.init().then(() => {
      console.log("[home] Local database initialized");
    });
  }, []);

  // Device registration - runs after auth is confirmed
  useEffect(() => {
    const initializeDevice = async () => {
      if (!session?.user) {
        return;
      }

      try {
        let storedDeviceId = await getDeviceId();
        console.log("Stored Device ID:", storedDeviceId);
        const userAgent = `${Device.osName} ${Device.osVersion} (${Device.modelName})`;

        if (storedDeviceId) {
          try {
            // Try to update last seen with stored device ID
            await trpcClient.device.updateLastSeen.mutate({
              deviceId: storedDeviceId,
            });
          } catch (error) {
            // If device not found, clear the invalid ID and re-register
            console.log("[device-registration] Error structure:", JSON.stringify(error, null, 2));
            console.log("[device-registration] Error type:", typeof error);
            console.log("[device-registration] Is NOT_FOUND?", isTRPCNotFoundError(error));
            
            if (isTRPCNotFoundError(error)) {
              console.warn(
                "[device-registration drawer 1] Stored device not found, re-registering",
              );
              await clearDeviceId();
              storedDeviceId = null;
            } else {
              // Other errors (network, etc.) - rethrow to outer catch
              throw error;
            }
          }
        }

        // If no stored device (or was cleared due to NOT_FOUND), register new device
        if (!storedDeviceId) {
          const device = await trpcClient.device.register.mutate({
            deviceType: "mobile",
            userAgent,
          });

          console.log("Registered new device:", device);

          if (!device?.id) {
            throw new Error(
              "Device registration failed: no device ID returned",
            );
          }

          // Store the new device ID
          await storeDeviceId(device.id);

          // Verify the device exists by immediately updating last seen
          await trpcClient.device.updateLastSeen.mutate({
            deviceId: device.id,
          });
        }
      } catch (error) {
        console.error("[device-registration drawer 2] Silent failure:", error);
      }
    };

    initializeDevice();
  }, [session?.user]);

  // Message subscription for real-time delivery
  useEffect(() => {
    if (!session?.user) {
      return;
    }

    const initMessageSubscription = async () => {
      const deviceId = await getDeviceId();
      if (!deviceId) {
        return;
      }

      // Try to get last message ID for reconnection
      const lastMessageId = await SecureStore.getItemAsync(`lastMessageId_${deviceId}`);

      const subscription = trpcClient.message.onMessage.subscribe(
        { 
          deviceId,
          lastEventId: lastMessageId || undefined,
        },
        {
          onData(event) {
            // Check if this is an error event
            if (event.data?.code || (event as any).code) {
              return;
            }

            const eventType = event.data?.type;

            // Handle incoming messages
            if (eventType === "message:received") {
              const msg = event.data?.message;
              if (!msg || !msg.senderDeviceId || !msg.encryptedContent) {
                return;
              }

              // Decrypt and store the received message
              decryptReceivedMessage(
                msg.id,
                msg.senderDeviceId,
                msg.encryptedContent,
                deviceId,
                new Date(msg.sentAt).getTime()
              ).then(async () => {
                console.log("[home] Message received and stored");
                
                // Store this message ID for future reconnections
                await SecureStore.setItemAsync(`lastMessageId_${deviceId}`, msg.id);
                
                // Send delivery receipt
                trpcClient.message.updateStatus.mutate({
                  messageId: msg.id,
                  status: "delivered",
                });
              }).catch((error) => {
                console.error("[home] Failed to decrypt message:", error);
              });
            }
            
            // Handle status updates
            else if (eventType === "message:status_updated") {
              const { messageId, status } = event.data as any;
              if (messageId) {
                // Update local message status
                localDb.updateMessageStatus(messageId, status).catch((error) => {
                  console.error("[home] Failed to update message status:", error);
                });
              }
            }
          },
          onError(err) {
            console.error("[message-subscription] Error:", err);
          },
        },
      );

      return () => {
        subscription.unsubscribe();
      };
    };

    const cleanup = initMessageSubscription();
    return () => {
      cleanup.then((fn) => fn?.());
    };
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
          Welcome,{" "}
          <Text className="font-semibold text-[#7C3AED]">
            {session.user.name}
          </Text>
        </Text>
      </View>

      {/* Quick action cards */}
      <View className="gap-4">
        <Pressable
          className="w-full active:opacity-70"
          onPress={() => {
            router.push("/(drawer)/messages" as any);
          }}
        >
          <Card variant="secondary" className="p-6">
            <View className="items-center gap-3">
              <Ionicons name="chatbubble-outline" size={32} color={iconColor} />
              <Text className="text-xl font-semibold text-foreground">
                Messages
              </Text>
              <Text className="text-sm text-muted text-center">
                View your encrypted messages
              </Text>
            </View>
          </Card>
        </Pressable>

        <Pressable
          className="w-full active:opacity-70"
          onPress={() => {
            router.push("/(drawer)/pairing" as any);
          }}
        >
          <Card variant="secondary" className="p-6">
            <View className="items-center gap-3">
              <Ionicons name="qr-code-outline" size={32} color={iconColor} />
              <Text className="text-xl font-semibold text-foreground">
                Pair Device
              </Text>
              <Text className="text-sm text-muted text-center">
                Connect to desktop app
              </Text>
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
              <Text className="text-xl font-semibold text-foreground">
                Settings
              </Text>
              <Text className="text-sm text-muted text-center">
                Manage your account
              </Text>
            </View>
          </Card>
        </Pressable>
      </View>
    </Container>
  );
}
