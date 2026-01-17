import { Redirect, router } from "expo-router";
import { Button, ErrorView, Spinner, TextField, useThemeColor } from "heroui-native";
import { useState } from "react";
import { Text, View, Pressable, StyleSheet } from "react-native";

import { Container } from "@/components/container";
import { authClient } from "@/lib/auth-client";
import { queryClient } from "@/utils/trpc";

export default function Login() {
  const { data: session } = authClient.useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session?.user) {
    return <Redirect href="/(drawer)" />;
  }

  async function handleLogin() {
    if (!email || !password) {
      setError("All fields are required");
      return;
    }

    setIsLoading(true);
    setError(null);

    await authClient.signIn.email(
      { email, password },
      {
        onError(error) {
          setError(error.error?.message || "Failed to sign in");
          setIsLoading(false);
        },
        onSuccess() {
          setEmail("");
          setPassword("");
          queryClient.refetchQueries();
          router.replace("/(drawer)" as any);
        },
        onFinished() {
          setIsLoading(false);
        },
      },
    );
  }

  return (
    <Container edges={["top", "bottom"]} scrollable={true}>
      <View style={styles.scrollContent}>
        <View className="mb-8">
          <Text
            className="text-3xl font-bold mb-2 text-foreground"
            style={{ letterSpacing: -0.5 }}
          >
            Welcome back
          </Text>
          <Text className="text-base text-muted">
            Sign in to your AuxLink account
          </Text>
        </View>

        <View className="flex-1">
          <ErrorView isInvalid={!!error} className="mb-3">
            {error}
          </ErrorView>

          <View className="gap-4">
            <TextField>
              <TextField.Label>Email</TextField.Label>
              <TextField.Input
                value={email}
                onChangeText={setEmail}
                placeholder="email@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isLoading}
                accessibilityLabel="Email address input"

              />
            </TextField>

            <TextField>
              <TextField.Label>Password</TextField.Label>
              <TextField.Input
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
                editable={!isLoading}
                accessibilityLabel="Password input"
              />
            </TextField>

            <Button
              onPress={handleLogin}
              isDisabled={isLoading}
              className="w-full mt-2"
              style={{ backgroundColor: "#7C3AED" }}
              accessibilityLabel="Sign In, sign in to your account"
              accessibilityRole="button"
              accessibilityState={{ disabled: isLoading }}
            >
              {isLoading ? (
                <Spinner size="sm" color="default" />
              ) : (
                <Button.Label style={{ color: "#FFFFFF" }}>Sign In</Button.Label>
              )}
            </Button>
          </View>

          <View className="flex-row justify-center items-center mt-6">
            <Text className="text-sm text-muted">Don't have an account? </Text>
            <Pressable 
              onPress={() => router.push("/(auth)/signup" as any)}
              accessibilityLabel="Sign up, go to create account page"
              accessibilityRole="link"
            >
              <Text
                style={{ fontSize: 14, fontWeight: "600", color: "#7C3AED" }}
              >
                Sign up
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
  },
});
