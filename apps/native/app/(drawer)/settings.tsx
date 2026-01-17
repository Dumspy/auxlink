import { Redirect, router } from "expo-router";
import { Button, Card, useThemeColor } from "heroui-native";
import { Text, View, Alert, ScrollView } from "react-native";

import { Container } from "@/components/container";
import { ThemeToggle } from "@/components/theme-toggle";
import { authClient } from "@/lib/auth-client";
import { queryClient } from "@/utils/trpc";

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

        {/* App info */}
        <View className="items-center mt-8 gap-1">
          <Text className="text-xs text-muted">AuxLink v0.1.0</Text>
          <Text className="text-xs text-muted">End-to-end encrypted messaging</Text>
        </View>
      </View>
    </Container>
  );
}
