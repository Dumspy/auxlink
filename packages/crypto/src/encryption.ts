import { generateKeyPair as generateKeyPairNode, publicEncrypt, privateDecrypt, constants } from "crypto";
import { promisify } from "util";

const generateKeyPairAsync = promisify(generateKeyPairNode);

/**
 * Key pair interface
 */
export interface KeyPair {
  publicKey: string;   // PEM format
  privateKey: string;  // PEM format (PKCS#8)
}

/**
 * Generate RSA-2048 key pair for encryption
 * Uses Node.js crypto for Bun/server environments
 * 
 * @returns Promise<KeyPair> - Public and private keys in PEM format
 */
export const generateKeyPair = async (): Promise<KeyPair> => {
  try {
    const { publicKey, privateKey } = await generateKeyPairAsync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: "spki",
        format: "pem",
      },
      privateKeyEncoding: {
        type: "pkcs8",
        format: "pem",
      },
    });

    return {
      publicKey,
      privateKey,
    };
  } catch (error) {
    throw new Error(`Failed to generate key pair: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Encrypt data with RSA-OAEP using a public key
 * 
 * @param plaintext - Data to encrypt
 * @param publicKeyPEM - RSA public key in PEM format
 * @returns Promise<string> - Base64-encoded ciphertext
 */
export const encrypt = async (plaintext: string, publicKeyPEM: string): Promise<string> => {
  try {
    // Validate input
    if (!plaintext) {
      throw new Error("Plaintext cannot be empty");
    }
    if (!publicKeyPEM || !publicKeyPEM.includes("BEGIN PUBLIC KEY")) {
      throw new Error("Invalid public key format");
    }

    // RSA-2048 with OAEP can encrypt up to ~214 bytes
    // For larger messages, would need hybrid encryption (RSA + AES)
    const plaintextBuffer = Buffer.from(plaintext, "utf-8");
    if (plaintextBuffer.length > 190) {
      throw new Error("Message too large for RSA-2048 encryption (max 190 bytes). Consider hybrid encryption for larger messages.");
    }

    const encrypted = publicEncrypt(
      {
        key: publicKeyPEM,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      plaintextBuffer
    );

    return encrypted.toString("base64");
  } catch (error) {
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Decrypt RSA-OAEP encrypted data with a private key
 * 
 * @param ciphertext - Base64-encoded encrypted data
 * @param privateKeyPEM - RSA private key in PEM format
 * @returns Promise<string> - Decrypted plaintext
 */
export const decrypt = async (ciphertext: string, privateKeyPEM: string): Promise<string> => {
  try {
    // Validate input
    if (!ciphertext) {
      throw new Error("Ciphertext cannot be empty");
    }
    if (!privateKeyPEM || !privateKeyPEM.includes("BEGIN PRIVATE KEY")) {
      throw new Error("Invalid private key format");
    }

    const ciphertextBuffer = Buffer.from(ciphertext, "base64");

    const decrypted = privateDecrypt(
      {
        key: privateKeyPEM,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      ciphertextBuffer
    );

    return decrypted.toString("utf-8");
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : String(error)}`);
  }
};
