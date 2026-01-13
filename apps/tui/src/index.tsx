import { useState, useEffect, createContext } from "react";
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { hostname, platform, release } from "node:os";
import { getSession } from "@/lib/auth-client";
import { Auth } from "@/components/auth";
import { Menu } from "@/components/menu";
import { trpc } from "@/utils/trpc";
import { getDeviceId, storeDeviceId } from "@/lib/device-storage";

type Screen = "loading" | "auth" | "menu";

// Create a context for navigation callbacks
export const NavigationContext = createContext<{
  onArrowUp: () => void;
  onArrowDown: () => void;
  onKeyPress: (key: string) => void;
}>({
  onArrowUp: () => {},
  onArrowDown: () => {},
  onKeyPress: () => {},
});

// Global navigation handlers and state
let globalNavigationHandlers: {
  onArrowUp: () => void;
  onArrowDown: () => void;
  onKeyPress: (key: string) => void;
} = {
  onArrowUp: () => {},
  onArrowDown: () => {},
  onKeyPress: () => {},
};

// Track if we're in an input field to allow typing
let isInInputField = false;

export function setInputFieldFocus(focused: boolean) {
  isInInputField = focused;
}

function App() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [navigationHandlers, setNavigationHandlers] = useState(globalNavigationHandlers);

  useEffect(() => {
    async function checkSession() {
      const session = await getSession();
      setScreen(session ? "menu" : "auth");
    }

    checkSession();
  }, []);

  useEffect(() => {
    async function initializeDevice() {
      try {
        const session = await getSession();
        if (!session) {
          return;
        }

        const storedDeviceId = getDeviceId();
        const userAgent = `${platform()} ${release()} (${hostname()})`;

        if (storedDeviceId) {
          await trpc.device.updateLastSeen.mutate({ deviceId: storedDeviceId });
        } else {
          const device = await trpc.device.register.mutate({
            deviceType: "tui",
            userAgent,
          });
          if (device) {
            storeDeviceId(device.id);
          }
        }
      } catch (error) {
        console.error("[device-registration] Silent failure:", error);
      }
    }

    initializeDevice();
  }, [screen]);

  // Update global handlers when they change
  useEffect(() => {
    globalNavigationHandlers = navigationHandlers;
  }, [navigationHandlers]);

  if (screen === "loading") {
    return (
      <box alignItems="center" justifyContent="center" flexGrow={1}>
        <text fg="#7C3AED">⏳ Loading AuxLink...</text>
      </box>
    );
  }

  if (screen === "auth") {
    return (
      <box alignItems="center" justifyContent="center" flexGrow={1}>
        <NavigationContext.Provider value={navigationHandlers}>
          <Auth
            onSuccess={() => setScreen("menu")}
            onNavigationChange={setNavigationHandlers}
          />
        </NavigationContext.Provider>
      </box>
    );
  }

  if (screen === "menu") {
    return (
      <box alignItems="center" justifyContent="center" flexGrow={1}>
        <NavigationContext.Provider value={navigationHandlers}>
          <Menu
            onLogout={() => setScreen("auth")}
            onNavigationChange={setNavigationHandlers}
          />
        </NavigationContext.Provider>
      </box>
    );
  }

  return null;
}

// Input handler to intercept arrow keys and keyboard shortcuts
function handleInput(sequence: string): boolean {
  // Arrow key sequences
  const ARROW_UP = "\x1b[A";
  const ARROW_DOWN = "\x1b[B";
  const ARROW_RIGHT = "\x1b[C";
  const ARROW_LEFT = "\x1b[D";
  const ENTER = "\r";

  // If we're in an input field, still allow arrow keys for navigation
  // but block letter keys from being consumed by shortcuts
  if (isInInputField) {
    // Allow arrow keys to navigate between fields
    if (sequence === ARROW_UP || sequence === ARROW_LEFT) {
      globalNavigationHandlers.onArrowUp();
      return true;
    } else if (sequence === ARROW_DOWN || sequence === ARROW_RIGHT) {
      globalNavigationHandlers.onArrowDown();
      return true;
    }
    // Allow Tab key for switching tabs
    else if (sequence === "\t") {
      globalNavigationHandlers.onKeyPress(sequence);
      return true;
    }
    // Let all other keys (letters, numbers, backspace, etc.) pass through to input
    return false;
  }

  // Not in input field - handle navigation normally
  if (sequence === ARROW_UP || sequence === ARROW_LEFT) {
    globalNavigationHandlers.onArrowUp();
    return true;
  } else if (sequence === ARROW_DOWN || sequence === ARROW_RIGHT) {
    globalNavigationHandlers.onArrowDown();
    return true;
  } else if (sequence === ENTER) {
    // Enter key for activating focused item
    globalNavigationHandlers.onKeyPress(sequence);
    return true;
  } else if (sequence === "\t") {
    // Tab key for switching tabs or other actions
    globalNavigationHandlers.onKeyPress(sequence);
    return true;
  } else if (sequence.length === 1 && /[a-zA-Z?]/.test(sequence)) {
    globalNavigationHandlers.onKeyPress(sequence);
    return true;
  }

  return false;
}

const renderer = await createCliRenderer({
  prependInputHandlers: [handleInput],
});
createRoot(renderer).render(<App />);
