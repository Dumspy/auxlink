import { Redirect, router } from "expo-router";
import { Button, useThemeColor } from "heroui-native";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";

import { Container } from "@/components/container";
import { authClient } from "@/lib/auth-client";

export default function Welcome() {
  const { data: session } = authClient.useSession();

  if (session?.user) {
    return <Redirect href="/(drawer)" />;
  }

  return (
    <Container edges={["top", "bottom"]} scrollable={false}>
      <View style={styles.content}>
        {/* Logo and branding */}
        <View style={styles.logoSection}>
          <Svg
            width={120}
            height={120}
            viewBox="0 0 2000 2000"
            style={styles.logo}
          >
            <Path
              d="M597.3,1827.3h950.2L1000.1,323.1L424.3,1905h-82.6L1000.1,96l658.4,1809H597.3V1827.3z"
              fill="#7C3AED"
            />
          </Svg>
          <Text
            className="text-5xl font-bold mb-4 text-foreground"
            style={{ letterSpacing: -1 }}
          >
            Aux<Text style={{ color: "#7C3AED" }}>Link</Text>
          </Text>
          <Text className="text-base text-muted text-center leading-6">
            End-to-end encrypted messaging{"\n"}from mobile to desktop
          </Text>
        </View>

        {/* Action buttons */}
        <View style={styles.buttonSection}>
          <Button
            onPress={() => router.push("/(auth)/login" as any)}
            className="w-full"
            style={{ backgroundColor: "#7C3AED" }}
          >
            <Button.Label style={{ color: "#FFFFFF" }}>Get Started</Button.Label>
          </Button>

          <Button
            variant="secondary"
            onPress={() => router.push("/(auth)/signup" as any)}
            className="w-full"
          >
            <Button.Label>Create Account</Button.Label>
          </Button>

          <View className="flex-row justify-center items-center mt-2">
            <Text className="text-sm text-muted">Already have an account? </Text>
            <Pressable onPress={() => router.push("/(auth)/login" as any)}>
              <Text
                style={{ fontSize: 14, fontWeight: "600", color: "#7C3AED" }}
              >
                Sign in
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
    justifyContent: "space-between",
  },
  logoSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    marginBottom: 24,
  },
  buttonSection: {
    gap: 12,
  },
});
