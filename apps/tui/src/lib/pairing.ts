import { generateKeyPair } from "@auxlink/crypto";
import { generateQRMatrix } from "@auxlink/crypto/qr/matrix";
import { renderQRForOpenTUI } from "@auxlink/crypto/qr/renderer";
import { storePrivateKey, getPrivateKey } from "@auxlink/crypto/storage/tui";
import { trpc } from "@/utils/trpc";

export interface PairingState {
  status: "idle" | "generating" | "displaying" | "polling" | "completed" | "expired" | "error";
  qrCode?: string;
  sessionId?: string;
  expiresAt?: Date;
  mobileDevice?: {
    id: string;
    name: string;
    publicKey: string | null;
  };
  error?: string;
}

/**
 * Generate RSA key pair and store private key for a device
 */
export async function generateAndStoreKeys(deviceId: string): Promise<string> {
  const { publicKey, privateKey } = await generateKeyPair();
  await storePrivateKey(deviceId, privateKey);
  return publicKey;
}

/**
 * Check if device has keys stored
 */
export async function hasStoredKeys(deviceId: string): Promise<boolean> {
  try {
    const privateKey = await getPrivateKey(deviceId);
    return !!privateKey;
  } catch {
    return false;
  }
}

/**
 * Initiate pairing session and generate QR code
 */
export async function initiatePairing(
  tuiDeviceId: string
): Promise<{ qrCode: string; sessionId: string; expiresAt: Date }> {
  // Generate keys if not already present
  const hasKeys = await hasStoredKeys(tuiDeviceId);
  let publicKey: string | undefined;
  
  if (!hasKeys) {
    publicKey = await generateAndStoreKeys(tuiDeviceId);
  } else {
    // If keys exist, retrieve the public key (for AES, it's the same as private key)
    const privateKey = await getPrivateKey(tuiDeviceId);
    if (privateKey) {
      publicKey = privateKey; // For symmetric encryption, they're the same
    }
  }

  // Update device with public key if we have one
  if (publicKey) {
    await trpc.device.register.mutate({
      deviceType: "tui",
      deviceId: tuiDeviceId,
      publicKey: publicKey,
    });
  }

  // Create pairing session
  const session = await trpc.pairing.initiate.mutate({ tuiDeviceId });

  // Generate QR code matrix with low error correction for smaller size
  const matrix = await generateQRMatrix(session.qrPayload, "L");

  // Render QR code for OpenTUI in compact mode (half height)
  const qrCode = renderQRForOpenTUI(matrix, {
    compact: true,  // Use half-height rendering
    padding: 1,     // Minimal padding
  });

  return {
    qrCode,
    sessionId: session.sessionId,
    expiresAt: new Date(session.expiresAt),
  };
}

/**
 * Poll pairing session status
 */
export async function checkPairingStatus(sessionId: string): Promise<{
  status: "pending" | "scanned" | "completed" | "expired";
  mobileDevice?: {
    id: string;
    name: string;
    publicKey: string | null;
  };
}> {
  const result = await trpc.pairing.getStatus.query({ sessionId });

  return {
    status: result.status,
    mobileDevice: result.status === "completed" ? result.mobileDevice : undefined,
  };
}

/**
 * Cancel pairing session
 */
export async function cancelPairing(sessionId: string): Promise<void> {
  await trpc.pairing.cancel.mutate({ sessionId });
}
