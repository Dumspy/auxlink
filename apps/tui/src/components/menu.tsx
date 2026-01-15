import { useState, useEffect } from "react";
import { authClient, getSession } from "@/lib/auth-client";
import { storage } from "@/lib/storage";
import { getDeviceId } from "@/lib/device-storage";
import { trpc } from "@/utils/trpc";
import { logger } from "@/lib/logger";
import { Pairing } from "@/components/pairing";

interface MenuProps {
  onLogout: () => void;
  onNavigationChange: (handlers: {
    onArrowUp: () => void;
    onArrowDown: () => void;
    onKeyPress: (key: string) => void;
  }) => void;
}

type MenuItem = "messages" | "pairing" | "settings" | "logout";
type LogoutFocus = "yes" | "no";
type Screen = "menu" | "pairing";

export function Menu({ onLogout, onNavigationChange }: MenuProps) {
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>("menu");
  const [focusedItem, setFocusedItem] = useState<MenuItem>("messages");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [logoutFocus, setLogoutFocus] = useState<LogoutFocus>("no");
  const [showHelp, setShowHelp] = useState(false);

  const menuItems: MenuItem[] = ["messages", "pairing", "settings", "logout"];

  // Handle navigation and keyboard shortcuts
  useEffect(() => {
    if (showLogoutConfirm) {
      // Logout confirmation navigation
      onNavigationChange({
        onArrowUp: () => {
          setLogoutFocus("yes");
        },
        onArrowDown: () => {
          setLogoutFocus("no");
        },
        onKeyPress: (key: string) => {
          if (key === "y" || key === "Y" || (key === "\r" && logoutFocus === "yes")) {
            handleLogout();
          } else if (key === "n" || key === "N" || key === "q" || key === "Q" || (key === "\r" && logoutFocus === "no")) {
            setShowLogoutConfirm(false);
          }
        },
      });
      return;
    }

    if (showHelp) {
      // Help screen navigation
      onNavigationChange({
        onArrowUp: () => {},
        onArrowDown: () => {},
        onKeyPress: () => {
          setShowHelp(false);
        },
      });
      return;
    }

    // Main menu navigation
    const currentIndex = menuItems.indexOf(focusedItem);

    onNavigationChange({
      onArrowUp: () => {
        if (currentIndex > 0) {
          setFocusedItem(menuItems[currentIndex - 1]!);
        }
      },
      onArrowDown: () => {
        if (currentIndex < menuItems.length - 1) {
          setFocusedItem(menuItems[currentIndex + 1]!);
        }
      },
      onKeyPress: (key: string) => {
        // Keyboard shortcuts
        if (key === "m" || key === "M") {
          setFocusedItem("messages");
          handleMenuAction("messages");
        } else if (key === "p" || key === "P") {
          setFocusedItem("pairing");
          handleMenuAction("pairing");
        } else if (key === "s" || key === "S") {
          setFocusedItem("settings");
          handleMenuAction("settings");
        } else if (key === "q" || key === "Q") {
          setFocusedItem("logout");
          setShowLogoutConfirm(true);
        } else if (key === "?" || key === "h" || key === "H") {
          setShowHelp(!showHelp);
        } else if (key === "\r") {
          // Enter key - activate focused item
          handleMenuAction(focusedItem);
        }
      },
    });
  }, [focusedItem, showHelp, showLogoutConfirm, logoutFocus, onNavigationChange]);

  useEffect(() => {
    async function loadUser() {
      try {
        const session = await getSession();
        if (session?.user) {
          setUser({
            name: session.user.name,
            email: session.user.email,
          });
        }
      } catch (err) {
        console.error("Failed to load user:", err);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

  // Message subscription for real-time delivery
  useEffect(() => {
    if (!user) {
      return;
    }

    const setupSubscription = async () => {
      const deviceId = await getDeviceId();
      if (!deviceId) {
        return;
      }

      // Try to get last message ID for reconnection
      const lastMessageId = await storage.getItem(`lastMessageId:${deviceId}`);

      try {
        const subscription = trpc.message.onMessage.subscribe(
          { 
            deviceId,
            lastEventId: lastMessageId || undefined,
          },
          {
            async onData(event: any) {
              // Check if this is an error event (has code/data but no message object)
              if (event?.code || event?.data?.code) {
                return;
              }
              
              // Extract message from event
              const msg = event?.data?.message;
              
              if (!msg || !msg.senderDeviceId || !msg.encryptedContent) {
                return;
              }
              
              // Store this message ID for future reconnections
              await storage.setItem(`lastMessageId:${deviceId}`, msg.id);
              
              // TODO: Handle received message (Phase 4 - add to message store)
            },
            onError(err: any) {
              console.error("[message-subscription] Error:", err);
            },
          }
        );

        return () => {
          subscription.unsubscribe();
        };
      } catch (error: any) {
        console.error("[message-subscription] Failed to create subscription:", error);
      }
    };

    setupSubscription();
  }, [user]);

  async function handleLogout() {
    try {
      await authClient.signOut();
      await storage.removeItem("better-auth.session_token");
      onLogout();
    } catch (err) {
      await storage.removeItem("better-auth.session_token");
      onLogout();
    }
  }

  function handleMenuAction(item: MenuItem) {
    switch (item) {
      case "messages":
        // TODO: Navigate to messages screen (Phase 4)
        break;
      case "pairing":
        setScreen("pairing");
        break;
      case "settings":
        // TODO: Navigate to settings screen (Phase 5)
        break;
      case "logout":
        setShowLogoutConfirm(true);
        setLogoutFocus("no"); // Default to "No, cancel" for safety
        break;
    }
  }

  if (loading) {
    return (
      <box style={{ flexDirection: "column", gap: 1, alignItems: "center", alignSelf: "center" }}>
        <text fg="#7C3AED">⏳ Loading...</text>
      </box>
    );
  }

  // Pairing screen
  if (screen === "pairing") {
    return <Pairing onBack={() => setScreen("menu")} onNavigationChange={onNavigationChange} />;
  }

  // Logout confirmation dialog
  if (showLogoutConfirm) {
    return (
      <box style={{ flexDirection: "column", gap: 1, minWidth: 50, alignItems: "center", alignSelf: "center" }}>
        <text fg="#7C3AED">Logout</text>
        <text></text>
        <text fg="#FFFFFF">Are you sure you want to logout?</text>
        <text></text>
        <box style={{ flexDirection: "column", gap: 0, alignItems: "flex-start" }}>
          <text fg={logoutFocus === "yes" ? "red" : "#888"}>
            {logoutFocus === "yes" ? "▶ " : "  "}[Y] Yes, logout
          </text>
          <text fg={logoutFocus === "no" ? "#7C3AED" : "#888"}>
            {logoutFocus === "no" ? "▶ " : "  "}[N] No, cancel
          </text>
        </box>
        <text></text>
        <text fg="#666">↑↓ Navigate • Y/N or Enter Confirm</text>
      </box>
    );
  }

  // Help dialog
  if (showHelp) {
    return (
      <box style={{ flexDirection: "column", gap: 1, minWidth: 50, alignItems: "center", alignSelf: "center" }}>
        <text fg="#7C3AED">Keyboard Shortcuts</text>
        <text></text>
        <box style={{ flexDirection: "column", gap: 0, alignItems: "flex-start" }}>
          <text fg="#FFFFFF">M - Messages</text>
          <text fg="#FFFFFF">P - Pairing</text>
          <text fg="#FFFFFF">S - Settings</text>
          <text fg="#FFFFFF">Q - Logout</text>
          <text fg="#FFFFFF">? - Toggle Help</text>
        </box>
        <text></text>
        <text fg="#888">↑↓ Navigate • Enter Select</text>
        <text></text>
        <text fg="#666">Press any key to close</text>
      </box>
    );
  }

  // Main menu - terminal-native style
  return (
    <box style={{ flexDirection: "column", gap: 1, minWidth: 50, alignItems: "center", alignSelf: "center" }}>
      <text fg="#7C3AED">AuxLink</text>
      <text fg="#666">Welcome, {user?.name || "User"}!</text>
      <text fg="#444">{user?.email || "N/A"}</text>
      <text></text>

      <text fg="#888">MAIN MENU</text>
      <text></text>

      {/* Menu items - simple text list */}
      <box style={{ flexDirection: "column", gap: 0, alignItems: "flex-start" }}>
        <text fg={focusedItem === "messages" ? "#7C3AED" : "#FFFFFF"}>
          {focusedItem === "messages" ? "▶" : " "} [M] Messages
        </text>
        <text fg={focusedItem === "pairing" ? "#7C3AED" : "#FFFFFF"}>
          {focusedItem === "pairing" ? "▶" : " "} [P] Pairing
        </text>
        <text fg={focusedItem === "settings" ? "#7C3AED" : "#FFFFFF"}>
          {focusedItem === "settings" ? "▶" : " "} [S] Settings
        </text>
        <text fg={focusedItem === "logout" ? "red" : "#FFFFFF"}>
          {focusedItem === "logout" ? "▶" : " "} [Q] Logout
        </text>
      </box>

      <text></text>
      <text fg="#666">Press letter key or ↑↓ to navigate • ? for help</text>
    </box>
  );
}
