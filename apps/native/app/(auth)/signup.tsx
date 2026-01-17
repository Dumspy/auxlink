import { Redirect, router } from "expo-router";
import { Button, ErrorView, Spinner, TextField, useThemeColor } from "heroui-native";
import { useState } from "react";
import { Text, View, Pressable, StyleSheet } from "react-native";

import { Container } from "@/components/container";
import { authClient } from "@/lib/auth-client";
import { queryClient } from "@/utils/trpc";

export default function SignUp() {
  const { data: session } = authClient.useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session?.user) {
    return <Redirect href="/(drawer)" />;
  }

  async function handleSignUp() {
    if (!name || !email || !password) {
      setError("All fields are required");
      return;
    }

    setIsLoading(true);
    setError(null);

    await authClient.signUp.email(
      { name, email, password },
      {
        onError(error) {
          setError(error.error?.message || "Failed to sign up");
          setIsLoading(false);
        },
        onSuccess() {
          setName("");
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
            Create an account
          </Text>
          <Text className="text-base text-muted">
            Get started with AuxLink today
          </Text>
        </View>

        <View className="flex-1">
          <ErrorView isInvalid={!!error} className="mb-3">
            {error}
          </ErrorView>

          <View className="gap-4">
            <TextField>
              <TextField.Label>Name</TextField.Label>
              <TextField.Input
                value={name}
                onChangeText={setName}
                placeholder="John Doe"
                editable={!isLoading}
              />
            </TextField>

            <TextField>
              <TextField.Label>Email</TextField.Label>
              <TextField.Input
                value={email}
                onChangeText={setEmail}
                placeholder="email@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isLoading}
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
              />
            </TextField>

            <Button
              onPress={handleSignUp}
              isDisabled={isLoading}
              className="w-full mt-2"
              style={{ backgroundColor: "#7C3AED" }}
            >
              {isLoading ? (
                <Spinner size="sm" color="default" />
              ) : (
                <Button.Label style={{ color: "#FFFFFF" }}>
                  Create Account
                </Button.Label>
              )}
            </Button>
          </View>

          <View className="flex-row justify-center items-center mt-6">
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
  },
});
