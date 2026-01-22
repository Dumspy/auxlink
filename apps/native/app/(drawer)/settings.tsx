import { Redirect, router } from "expo-router";
import { Button, Card, useThemeColor } from "heroui-native";
import { Text, View, Alert, ScrollView } from "react-native";

import { Container } from "@/components/container";
import { ThemeToggle } from "@/components/theme-toggle";
import { authClient } from "@/lib/auth-client";
import { queryClient } from "@/utils/trpc";
import { clearAllLocalData } from "@/lib/clear-data";

export default function Settings() {
  const { data: session } = authClient.useSession();

  if (!session?.user) {
    return <Redirect href="/(auth)/welcome" />;
  }

  async function handleLogout() {
    Alert.alert("Confirm Logout", "Are you sure you want to logout?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await authClient.signOut();
          queryClient.invalidateQueries();
          router.replace("/(auth)/welcome" as any);
        },
      },
    ]);
  }

  async function handleClearData() {
    Alert.alert(
      "Clear All Data",
      "This will permanently delete all local data including:\n\n• Login session\n• Device ID\n• Encryption keys\n• All chat history\n\nThis action cannot be undone. Are you sure?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Clear Data",
          style: "destructive",
          onPress: async () => {
            try {
              await clearAllLocalData();
              router.replace("/(auth)/login" as any);
            } catch (error) {
              Alert.alert(
                "Error",
                `Failed to clear data: ${error instanceof Error ? error.message : "Unknown error"}`
              );
            }
          },
        },
      ]
    );
  }

  return (
    <Container scrollable={true}>
      <View className="px-6 pt-4 pb-6">
        <View className="mb-6">
          <Text className="text-3xl font-bold text-foreground">Settings</Text>
        </View>

        {/* User info */}
        <Card variant="secondary" className="p-4 mb-4">
          <Text className="text-lg font-semibold mb-4 text-foreground">Account</Text>
          <View className="flex-row justify-between items-center py-2">
            <Text className="text-base text-muted">Name</Text>
            <Text className="text-base font-medium text-foreground">{session?.user?.name || "N/A"}</Text>
          </View>
          <View className="flex-row justify-between items-center py-2">
            <Text className="text-base text-muted">Email</Text>
            <Text className="text-base font-medium text-foreground">{session?.user?.email || "N/A"}</Text>
          </View>
        </Card>

        {/* Theme toggle */}
        <Card variant="secondary" className="p-4 mb-4">
          <Text className="text-lg font-semibold mb-4 text-foreground">Appearance</Text>
          <View className="flex-row justify-between items-center">
            <Text className="text-base text-muted">Theme</Text>
            <ThemeToggle />
          </View>
        </Card>

        {/* Logout button */}
        <Button
          onPress={handleLogout}
          className="w-full mt-2"
          style={{ backgroundColor: "#EF4444" }}
          accessibilityLabel="Logout, sign out of your account"
          accessibilityRole="button"
        >
          <Button.Label style={{ color: "#FFFFFF" }}>Logout</Button.Label>
        </Button>

        {/* Clear all data button */}
        <Button
          onPress={handleClearData}
          className="w-full mt-2"
          style={{ backgroundColor: "transparent", borderColor: "#EF4444", borderWidth: 1 }}
          accessibilityLabel="Clear all local data, including login session and chat history"
          accessibilityRole="button"
        >
          <Button.Label style={{ color: "#EF4444" }}>Clear All Data</Button.Label>
        </Button>

        {/* App info */}
        <View className="items-center mt-8 gap-1">
          <Text className="text-xs text-muted">AuxLink v0.1.0</Text>
          <Text className="text-xs text-muted">End-to-end encrypted messaging</Text>
        </View>
      </View>
    </Container>
  );
}
