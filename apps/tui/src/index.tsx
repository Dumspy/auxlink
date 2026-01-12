import { useState, useEffect, createContext } from "react";
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { getSession } from "@/lib/auth-client";
import { SignUp } from "@/components/sign-up";
import { Login } from "@/components/login";
import { Dashboard } from "@/components/dashboard";

type Screen = "loading" | "login" | "signup" | "dashboard";

// Create a context for navigation callbacks
export const NavigationContext = createContext<{
  onArrowUp: () => void;
  onArrowDown: () => void;
}>({
  onArrowUp: () => {},
  onArrowDown: () => {},
});

// Global navigation handlers
let globalNavigationHandlers: {
  onArrowUp: () => void;
  onArrowDown: () => void;
} = {
  onArrowUp: () => {},
  onArrowDown: () => {},
};

function App() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [navigationHandlers, setNavigationHandlers] = useState(globalNavigationHandlers);

  useEffect(() => {
    async function checkSession() {
      const session = await getSession();
      setScreen(session ? "dashboard" : "signup");
    }

    checkSession();
  }, []);

  // Update global handlers when they change
  useEffect(() => {
    globalNavigationHandlers = navigationHandlers;
  }, [navigationHandlers]);



  if (screen === "loading") {
    return (
      <box alignItems="center" justifyContent="center" flexGrow={1}>
        <text fg="#00FF00">Loading...</text>
      </box>
    );
  }

  if (screen === "signup") {
    return (
      <box alignItems="center" justifyContent="center" flexGrow={1}>
        <NavigationContext.Provider value={navigationHandlers}>
          <SignUp
            onSuccess={() => setScreen("dashboard")}
            onSwitchToLogin={() => setScreen("login")}
            onNavigationChange={setNavigationHandlers}
          />
        </NavigationContext.Provider>
      </box>
    );
  }

  if (screen === "login") {
    return (
      <box alignItems="center" justifyContent="center" flexGrow={1}>
        <NavigationContext.Provider value={navigationHandlers}>
          <Login
            onSuccess={() => setScreen("dashboard")}
            onSwitchToSignUp={() => setScreen("signup")}
            onNavigationChange={setNavigationHandlers}
          />
        </NavigationContext.Provider>
      </box>
    );
  }

  if (screen === "dashboard") {
    return (
      <box alignItems="center" justifyContent="center" flexGrow={1}>
        <NavigationContext.Provider value={navigationHandlers}>
          <Dashboard
            onLogout={() => setScreen("login")}
            onNavigationChange={setNavigationHandlers}
          />
        </NavigationContext.Provider>
      </box>
    );
  }

  return null;
}

// Input handler to intercept arrow keys
function handleInput(sequence: string): boolean {
  // Arrow key sequences
  const ARROW_UP = "\x1b[A";
  const ARROW_DOWN = "\x1b[B";
  const ARROW_RIGHT = "\x1b[C";
  const ARROW_LEFT = "\x1b[D";

  if (sequence === ARROW_UP || sequence === ARROW_LEFT) {
    globalNavigationHandlers.onArrowUp();
    return true; // Consume the event
  } else if (sequence === ARROW_DOWN || sequence === ARROW_RIGHT) {
    globalNavigationHandlers.onArrowDown();
    return true; // Consume the event
  }

  return false; // Let other keys pass through
}

const renderer = await createCliRenderer({
  prependInputHandlers: [handleInput],
});
createRoot(renderer).render(<App />);
