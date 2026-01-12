import { useState, useEffect } from "react";
import { authClient } from "@/lib/auth-client";

interface SignUpProps {
  onSuccess: () => void;
  onSwitchToLogin: () => void;
  onNavigationChange: (handlers: { onArrowUp: () => void; onArrowDown: () => void }) => void;
}

export function SignUp({ onSuccess, onSwitchToLogin, onNavigationChange }: SignUpProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [focusedField, setFocusedField] = useState<
    "name" | "email" | "password" | "submit" | "switchToLogin"
  >("name");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Define field order for navigation
  const fields: Array<"name" | "email" | "password" | "submit" | "switchToLogin"> = [
    "name",
    "email",
    "password",
    "submit",
    "switchToLogin",
  ];

  // Handle arrow key navigation
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
    });
  }, [focusedField, onNavigationChange]);

  async function handleSubmit() {
    if (!name || !email || !password) {
      setError("All fields are required");
      return;
    }

    setLoading(true);
    setError(null);

    await authClient.signUp.email(
      {
        name,
        email,
        password,
      },
      {
        onError(error) {
          setError(error.error?.message || "Sign up failed");
          setLoading(false);
        },
        onSuccess() {
          setName("");
          setEmail("");
          setPassword("");
          onSuccess();
        },
        onFinished() {
          setLoading(false);
        },
      },
    );
  }

  return (
    <box
      style={{
        flexDirection: "column",
        gap: 1,
        padding: 2,
        border: true,
        borderStyle: "double",
        width: 50,
      }}
    >
      <text fg="#00FF00">🚀 Create Account</text>

      {error && (
        <box style={{ backgroundColor: "#330000", padding: 1 }}>
          <text fg="red">{error}</text>
        </box>
      )}

      <box title="Name" style={{ border: true, height: 3 }}>
        <input
          value={name}
          placeholder="John Doe"
          focused={focusedField === "name"}
          onInput={setName}
          onSubmit={() => setFocusedField("email")}
        />
      </box>

      <box title="Email" style={{ border: true, height: 3 }}>
        <input
          value={email}
          placeholder="email@example.com"
          focused={focusedField === "email"}
          onInput={setEmail}
          onSubmit={() => setFocusedField("password")}
        />
      </box>

      <box title="Password" style={{ border: true, height: 3 }}>
        <input
          value={password}
          placeholder="••••••••"
          focused={focusedField === "password"}
          onInput={setPassword}
          onSubmit={() => setFocusedField("submit")}
        />
      </box>

      <box style={{ flexDirection: "row", gap: 2, marginTop: 1 }}>
        <box
          title="Submit"
          style={{
            border: true,
            borderColor: focusedField === "submit" ? "#00FF00" : "#888888",
            padding: 1,
            flexGrow: 1,
            height: 3,
          }}
        >
          <input
            value=""
            placeholder="Press Enter"
            focused={focusedField === "submit"}
            onInput={() => {}}
            onSubmit={async () => {
              await handleSubmit();
            }}
          />
        </box>

        <box
          title="Switch to Login"
          style={{
            border: true,
            borderColor: focusedField === "switchToLogin" ? "#00FF00" : "#888888",
            padding: 1,
            flexGrow: 1,
            height: 3,
          }}
        >
          <input
            value=""
            placeholder="Press Enter"
            focused={focusedField === "switchToLogin"}
            onInput={() => {}}
            onSubmit={() => {
              onSwitchToLogin();
            }}
          />
        </box>
      </box>

      <text fg="#888">
        {loading ? "Creating account..." : "Arrow keys: navigate • Enter: activate"}
      </text>
    </box>
  );
}
