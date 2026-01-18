import { Stack } from "expo-router";
import { useThemeColor } from "heroui-native";

export default function MessagesLayout() {
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
          headerShown: false, // Hide this since the main drawer handles the Messages header
        }} 
      />
      <Stack.Screen 
        name="chat" 
        options={{ 
          headerTitle: "Chat",
          headerBackTitle: "Messages",
        }} 
      />
    </Stack>
  );
}