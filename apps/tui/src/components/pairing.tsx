import { useState, useEffect, useCallback } from "react";
import { getDeviceId } from "@/lib/device-storage";
import {
  initiatePairing,
  checkPairingStatus,
  cancelPairing,
  type PairingState,
} from "@/lib/pairing";

interface PairingProps {
  onBack: () => void;
  onNavigationChange: (handlers: {
    onArrowUp: () => void;
    onArrowDown: () => void;
    onKeyPress: (key: string) => void;
  }) => void;
}

type ButtonFocus = "cancel" | "done";

export function Pairing({ onBack, onNavigationChange }: PairingProps) {
  const [state, setState] = useState<PairingState>({ status: "idle" });
  const [buttonFocus, setButtonFocus] = useState<ButtonFocus>("cancel");
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  // Poll for pairing completion
  const startPolling = useCallback((sessionId: string, expiresAt: Date) => {
    const pollInterval = setInterval(async () => {
      try {
        // Check if expired
        if (Date.now() >= expiresAt.getTime()) {
          clearInterval(pollInterval);
          setState({ status: "expired" });
          return;
        }

        // Check pairing status
        const result = await checkPairingStatus(sessionId);

        if (result.status === "completed") {
          clearInterval(pollInterval);
          setState({
            status: "completed",
            mobileDevice: result.mobileDevice,
          });
        } else if (result.status === "expired") {
          clearInterval(pollInterval);
          setState({ status: "expired" });
        }
      } catch (error: any) {
        // Continue polling on error
        console.error("[pairing] Poll error:", error);
      }
    }, 2000); // Poll every 2 seconds

    // Return cleanup function
    return () => clearInterval(pollInterval);
  }, []);

  // Initialize pairing when component mounts
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    async function startPairing() {
      try {
        setState({ status: "generating" });

        const deviceId = await getDeviceId();
        if (!deviceId) {
          setState({ status: "error", error: "Device not registered" });
          return;
        }

        // Initiate pairing and generate QR code
        const { qrCode, sessionId, expiresAt } = await initiatePairing(deviceId);

        setState({
          status: "displaying",
          qrCode,
          sessionId,
          expiresAt,
        });

        // Start polling for pairing completion and store cleanup function
        cleanup = startPolling(sessionId, expiresAt);
      } catch (error: any) {
        setState({
          status: "error",
          error: error.message || "Failed to initiate pairing",
        });
      }
    }

    startPairing();

    // Cleanup on unmount
    return () => {
      if (cleanup) {
        cleanup();
      }
    };
  }, [startPolling]);

  // Update time remaining
  useEffect(() => {
    if (state.status !== "displaying" && state.status !== "polling") {
      return;
    }

    if (!state.expiresAt) {
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, state.expiresAt!.getTime() - now);
      setTimeRemaining(Math.ceil(remaining / 1000));

      if (remaining === 0) {
        setState({ status: "expired" });
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [state.status, state.expiresAt]);

  // Handle cancel action
  async function handleCancel() {
    if (state.sessionId && (state.status === "displaying" || state.status === "polling")) {
      try {
        await cancelPairing(state.sessionId);
      } catch (error) {
        console.error("[pairing] Cancel error:", error);
      }
    }
    onBack();
  }

  // Handle navigation
  useEffect(() => {
    if (state.status === "completed") {
      // Completed state - only "Done" button
      onNavigationChange({
        onArrowUp: () => {},
        onArrowDown: () => {},
        onKeyPress: (key: string) => {
          if (key === "\r" || key === "d" || key === "D") {
            onBack();
          } else if (key === "q" || key === "Q") {
            onBack();
          }
        },
      });
      return;
    }

    if (state.status === "error" || state.status === "expired") {
      // Error/Expired state - only back action
      onNavigationChange({
        onArrowUp: () => {},
        onArrowDown: () => {},
        onKeyPress: (key: string) => {
          if (key === "\r" || key === "q" || key === "Q") {
            onBack();
          }
        },
      });
      return;
    }

    // Displaying/Polling state - Cancel button
    onNavigationChange({
      onArrowUp: () => {},
      onArrowDown: () => {},
      onKeyPress: (key: string) => {
        if (key === "\r" || key === "c" || key === "C" || key === "q" || key === "Q") {
          handleCancel();
        }
      },
    });
  }, [state.status, onNavigationChange]);

  // Cleanup effect - ensure navigation handlers are reset when component unmounts
  useEffect(() => {
    return () => {
      // Reset navigation handlers to empty state when unmounting
      onNavigationChange({
        onArrowUp: () => {},
        onArrowDown: () => {},
        onKeyPress: () => {},
      });
    };
  }, [onNavigationChange]);

  // Error state
  if (state.status === "error") {
    return (
      <box style={{ flexDirection: "column", gap: 1, minWidth: 60, alignItems: "center", alignSelf: "center" }}>
        <text fg="red">{"Pairing Error"}</text>
        <text></text>
        <text fg="#FFFFFF">{`${state.error || "Unknown error occurred"}`}</text>
        <text></text>
        <text fg="#666">{"Press Q or Enter to go back"}</text>
      </box>
    );
  }

  // Expired state
  if (state.status === "expired") {
    return (
      <box style={{ flexDirection: "column", gap: 1, minWidth: 60, alignItems: "center", alignSelf: "center" }}>
        <text fg="#FFA500">{"Pairing Expired"}</text>
        <text></text>
        <text fg="#FFFFFF">{"QR code expired after 5 minutes"}</text>
        <text fg="#888">{"Please try again"}</text>
        <text></text>
        <text fg="#666">{"Press Q or Enter to go back"}</text>
      </box>
    );
  }

  // Completed state
  if (state.status === "completed") {
    return (
      <box style={{ flexDirection: "column", gap: 1, minWidth: 60, alignItems: "center", alignSelf: "center" }}>
        <text fg="#00FF00">{"Pairing Successful!"}</text>
        <text></text>
        <text fg="#7C3AED">{"Mobile Device Paired"}</text>
        <text fg="#FFFFFF">{`Name: ${state.mobileDevice?.name || "Unknown"}`}</text>
        <text fg="#888">{`ID: ${state.mobileDevice?.id || "Unknown"}`}</text>
        <text></text>
        <text fg="#00FF00">{"✓ You can now send messages between devices"}</text>
        <text></text>
        <text fg="#666">{"Press D or Enter to continue"}</text>
      </box>
    );
  }

  // Generating state
  if (state.status === "generating") {
    return (
      <box style={{ flexDirection: "column", gap: 1, minWidth: 60, alignItems: "center", alignSelf: "center" }}>
        <text fg="#7C3AED">{"Device Pairing"}</text>
        <text></text>
        <text fg="#FFFFFF">{"⏳ Generating QR code..."}</text>
      </box>
    );
  }

  // Displaying/Polling state (QR code visible)
  const formattedTime = `${Math.floor(timeRemaining / 60)}:${String(timeRemaining % 60).padStart(2, "0")}`;

  return (
    <box style={{ flexDirection: "column", gap: 1, minWidth: 60, alignItems: "center", alignSelf: "center" }}>
      <text fg="#7C3AED">{"Device Pairing"}</text>
      <text></text>
      <text fg="#FFFFFF">{"Scan this QR code with your mobile device:"}</text>
      <text></text>

      {/* QR Code */}
      <box style={{ flexDirection: "column", alignItems: "center", alignSelf: "center" }}>
        <text fg="#FFFFFF">
          {`${state.qrCode || ""}`}
        </text>
      </box>

      <text></text>
      <text fg="#888">{`Time remaining: ${formattedTime}`}</text>
      <text></text>
      <text fg="#666">{"⏳ Waiting for mobile device to scan..."}</text>
      <text></text>
      <text fg="#666">{"Press C or Q to cancel"}</text>
    </box>
  );
}
