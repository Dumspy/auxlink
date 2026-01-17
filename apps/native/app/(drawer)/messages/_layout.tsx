import { Ionicons } from "@expo/vector-icons";
import { Stack, useNavigation } from "expo-router";
import { useThemeColor } from "heroui-native";
import { Pressable } from "react-native";

export default function MessagesLayout() {
  const navigation = useNavigation();
  const themeColorForeground = useThemeColor("foreground");
  const themeColorBackground = useThemeColor("background");

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: themeColorBackground },
        headerTintColor: themeColorForeground,
        headerTitleStyle: {
          fontWeight: "600",
          color: themeColorForeground,
        },
        contentStyle: { backgroundColor: themeColorBackground },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerTitle: "Messages",
          headerLeft: () => (
            <Pressable
              onPress={() => (navigation as any).openDrawer?.()}
              className="ml-4"
            >
              <Ionicons name="menu" size={24} color={themeColorForeground} />
            </Pressable>
          ),
        }}
      />
      <Stack.Screen name="chat" options={{ headerShown: true }} />
    </Stack>
  );
}
