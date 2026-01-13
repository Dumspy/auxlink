import { useState, useEffect, useCallback } from "react";
import { authClient } from "@/lib/auth-client";
import { setInputFieldFocus } from "../index";

interface AuthProps {
  onSuccess: () => void;
  onNavigationChange: (handlers: {
    onArrowUp: () => void;
    onArrowDown: () => void;
    onKeyPress: (key: string) => void;
  }) => void;
}

type AuthTab = "login" | "signup";

export function Auth({ onSuccess, onNavigationChange }: AuthProps) {
  const [tab, setTab] = useState<AuthTab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [focusedField, setFocusedField] = useState<
    "email" | "password" | "name" | "submit"
  >("email");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Define field order for navigation based on current tab
  const getFields = () => {
    const baseFields: Array<"email" | "password" | "name" | "submit"> = ["email", "password"];
    if (tab === "signup") {
      baseFields.splice(1, 0, "name"); // Insert name field after email
    }
    baseFields.push("submit");
    return baseFields;
  };

  const fields = getFields();

  // When switching tabs, reset form and focus
  const handleTabSwitch = useCallback(() => {
    setTab((currentTab) => currentTab === "login" ? "signup" : "login");
    setEmail("");
    setPassword("");
    setName("");
    setError(null);
    setFocusedField("email");
  }, []);

  const handleSubmit = useCallback(async () => {
    if (tab === "login") {
      if (!email || !password) {
        setError("All fields are required");
        return;
      }

      setLoading(true);
      setError(null);

      await authClient.signIn.email(
        { email, password },
        {
          onError(error) {
            setError(error.error?.message || "Login failed");
            setLoading(false);
          },
          onSuccess() {
            setEmail("");
            setPassword("");
            onSuccess();
          },
          onFinished() {
            setLoading(false);
          },
        },
      );
    } else {
      // Sign up
      if (!email || !password || !name) {
        setError("All fields are required");
        return;
      }

      setLoading(true);
      setError(null);

      await authClient.signUp.email(
        { email, password, name },
        {
          onError(error) {
            setError(error.error?.message || "Sign up failed");
            setLoading(false);
          },
          onSuccess() {
            setEmail("");
            setPassword("");
            setName("");
            onSuccess();
          },
          onFinished() {
            setLoading(false);
          },
        },
      );
    }
  }, [tab, email, password, name, onSuccess]);

  // Update input field focus state whenever focused field changes
  useEffect(() => {
    const isInputFocused = focusedField === "email" || focusedField === "password" || focusedField === "name";
    setInputFieldFocus(isInputFocused);
  }, [focusedField]);

  // Handle arrow key navigation and Tab key
  useEffect(() => {
    const currentIndex = fields.indexOf(focusedField);

    onNavigationChange({
      onArrowUp: () => {
        if (currentIndex > 0) {
          const prevField = fields[currentIndex - 1];
          if (prevField) setFocusedField(prevField);
        }
      },
      onArrowDown: () => {
        if (currentIndex < fields.length - 1) {
          const nextField = fields[currentIndex + 1];
          if (nextField) setFocusedField(nextField);
        }
      },
      onKeyPress: (key: string) => {
        // Tab key to switch between login/signup
        if (key === "\t" || key === "t" || key === "T") {
          handleTabSwitch();
        }
        // Enter key to submit when focused on submit button
        else if (key === "\r" && focusedField === "submit") {
          handleSubmit();
        }
      },
    });
  }, [focusedField, tab, fields, handleTabSwitch, handleSubmit, onNavigationChange]);

  return (
    <box style={{ flexDirection: "column", gap: 1, minWidth: 60, alignItems: "center", alignSelf: "center" }}>
      {/* Header */}
      <text fg="#7C3AED">AuxLink</text>
      <text fg="#666">{tab === "login" ? "Sign in to your account" : "Create a new account"}</text>
      <text></text>

      {/* Tab switcher - simple text-based */}
      <box style={{ flexDirection: "row", gap: 2 }}>
        <text fg={tab === "login" ? "#7C3AED" : "#666"}>
          {tab === "login" ? "▶" : " "} Login
        </text>
        <text fg="#444">|</text>
        <text fg={tab === "signup" ? "#7C3AED" : "#666"}>
          {tab === "signup" ? "▶" : " "} Sign Up
        </text>
        <text fg="#666"> (Tab to switch)</text>
      </box>
      <text></text>

      {error && (
        <>
          <text fg="red">✗ {error}</text>
          <text></text>
        </>
      )}

      {/* Form fields - wrapped in left-aligned box */}
      <box style={{ flexDirection: "column", gap: 1, alignItems: "flex-start", minWidth: 60 }}>
        <text fg="#888">Email:</text>
        <box style={{ 
          border: true, 
          borderStyle: "single",
          borderColor: focusedField === "email" ? "#7C3AED" : undefined,
          height: 3,
          width: 60
        }}>
          <input
            value={email}
            placeholder="email@example.com"
            focused={focusedField === "email"}
            onInput={setEmail}
            onSubmit={() => setFocusedField(tab === "signup" ? "name" : "password")}
          />
        </box>

        {tab === "signup" && (
          <>
            <text fg="#888">Name:</text>
            <box style={{ 
              border: true, 
              borderStyle: "single",
              borderColor: focusedField === "name" ? "#7C3AED" : undefined,
              height: 3,
              width: 60
            }}>
              <input
                value={name}
                placeholder="Your name"
                focused={focusedField === "name"}
                onInput={setName}
                onSubmit={() => setFocusedField("password")}
              />
            </box>
          </>
        )}

        <text fg="#888">Password:</text>
        <box style={{ 
          border: true, 
          borderStyle: "single",
          borderColor: focusedField === "password" ? "#7C3AED" : undefined,
          height: 3,
          width: 60
        }}>
          <input
            value={password}
            placeholder="••••••••"
            focused={focusedField === "password"}
            onInput={setPassword}
            onSubmit={() => setFocusedField("submit")}
          />
        </box>
      </box>

      <text></text>
      <text fg={focusedField === "submit" ? "#7C3AED" : "#FFFFFF"}>
        {focusedField === "submit" ? "▶ " : "  "}
        {tab === "login" ? "[Enter] Login" : "[Enter] Sign Up"}
      </text>

      <text></text>
      <text fg="#666">
        {loading
          ? tab === "login"
            ? "⏳ Logging in..."
            : "⏳ Signing up..."
          : "↑↓ Navigate • Enter Activate • Tab/T Switch"}
      </text>
    </box>
  );
}
