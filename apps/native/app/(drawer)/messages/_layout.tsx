import { Ionicons } from "@expo/vector-icons";
import { DrawerToggleButton } from "@react-navigation/drawer";
import { Stack } from "expo-router";
import { useThemeColor } from "heroui-native";
import { View } from "react-native";

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
        headerShadowVisible: true,
        headerTransparent: false,
        headerBackground: () => (
          <View style={{ flex: 1, backgroundColor: themeColorBackground }} />
        ),
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerTitle: "Messages",
          headerLeft: () => (
            <DrawerToggleButton tintColor={themeColorForeground} />
          ),
        }}
      />
      <Stack.Screen name="chat" options={{ headerShown: true }} />
    </Stack>
  );
}
