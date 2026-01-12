import { useState, useEffect } from "react";
import { authClient, getSession } from "@/lib/auth-client";
import { storage } from "@/lib/storage";
import { trpc } from "@/utils/trpc";

interface DashboardProps {
  onLogout: () => void;
  onNavigationChange: (handlers: { onArrowUp: () => void; onArrowDown: () => void }) => void;
}

export function Dashboard({ onLogout, onNavigationChange }: DashboardProps) {
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [healthStatus, setHealthStatus] = useState<string>("Checking...");
  const [loading, setLoading] = useState(true);
  const [focusLogout, setFocusLogout] = useState(false);

  // Dashboard only has one focusable element (logout button)
  // Arrow keys don't do anything here, but we still need to provide handlers
  useEffect(() => {
    onNavigationChange({
      onArrowUp: () => {}, // No-op
      onArrowDown: () => {}, // No-op
    });
  }, [onNavigationChange]);

  useEffect(() => {
    async function loadData() {
      try {
        // Get user session
        const session = await getSession();
        if (session?.user) {
          setUser({
            name: session.user.name,
            email: session.user.email,
          });
        }

        // Check health endpoint
        const health = await trpc.healthCheck.query();
        setHealthStatus(health);
      } catch (err: any) {
        setHealthStatus(`Error: ${err.message}`);
      } finally {
        setLoading(false);
        setFocusLogout(true); // Auto-focus logout button when loaded
      }
    }

    loadData();
  }, []);

  async function handleLogout() {
    try {
      await authClient.signOut();
      // Explicitly clear stored session token
      storage.removeItem("better-auth.session_token");
      console.log("[Auth] Logged out, token cleared");
      onLogout();
    } catch (err) {
      // Even if signOut fails, clear local token
      storage.removeItem("better-auth.session_token");
      console.log("[Auth] Logout failed, but token cleared locally");
      onLogout();
    }
  }

  if (loading) {
    return (
      <box
        style={{
          flexDirection: "column",
          gap: 1,
          padding: 2,
          border: true,
          borderStyle: "double",
          width: 60,
        }}
      >
        <text fg="#00FF00">⏳ Loading...</text>
      </box>
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
        width: 60,
      }}
    >
      <text fg="#00FF00">✨ Dashboard</text>

      <box style={{ marginTop: 1, marginBottom: 1 }}>
        <text fg="#FFFFFF">Welcome, </text>
        <text fg="#00AAFF">{user?.name || "User"}</text>
        <text fg="#FFFFFF">!</text>
      </box>

      <box style={{ border: true, padding: 1 }}>
        <box style={{ flexDirection: "column", gap: 1 }}>
          <text fg="#888">Email:</text>
          <text fg="#FFFFFF">{user?.email || "N/A"}</text>
        </box>
      </box>

      <box style={{ border: true, padding: 1, marginTop: 1 }}>
        <box style={{ flexDirection: "column", gap: 1 }}>
          <text fg="#888">Server Health:</text>
          <text fg={healthStatus === "OK" ? "#00FF00" : "#FF0000"}>
            {healthStatus}
          </text>
        </box>
      </box>

      <box
        title="Logout"
        style={{
          border: true,
          borderColor: focusLogout ? "#FF5555" : "#888888",
          padding: 1,
          marginTop: 2,
          height: 3,
        }}
      >
        <input
          value=""
          placeholder="Press Enter"
          focused={focusLogout}
          onInput={() => {}}
          onSubmit={handleLogout}
        />
      </box>

      <text fg="#888">
        {focusLogout ? "Press Enter to logout • Ctrl+C to exit" : "Press Enter to logout • Ctrl+C to exit"}
      </text>
    </box>
  );
}
