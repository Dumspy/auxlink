const KEYS_DIR = `${Bun.env.HOME}/.auxlink/keys`;

/**
 * Store RSA private key to filesystem (~/.auxlink/keys/{deviceId}.pem)
 * 
 * @param deviceId - Device UUID
 * @param privateKey - RSA private key in PEM format
 */
export const storePrivateKey = async (deviceId: string, privateKey: string): Promise<void> => {
  try {
    if (!deviceId) {
      throw new Error("Device ID is required");
    }
    if (!privateKey) {
      throw new Error("Private key is required");
    }

    const keyPath = `${KEYS_DIR}/${deviceId}.pem`;
    await Bun.write(keyPath, privateKey);
  } catch (error) {
    throw new Error(`Failed to store private key: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Retrieve RSA private key from filesystem
 * 
 * @param deviceId - Device UUID
 * @returns Promise<string | null> - Private key in PEM format, or null if not found
 */
export const getPrivateKey = async (deviceId: string): Promise<string | null> => {
  try {
    if (!deviceId) {
      throw new Error("Device ID is required");
    }

    const keyPath = `${KEYS_DIR}/${deviceId}.pem`;
    const file = Bun.file(keyPath);

    if (!(await file.exists())) {
      return null;
    }

    return (await file.text()).trim();
  } catch (error) {
    throw new Error(`Failed to retrieve private key: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Delete RSA private key from filesystem
 * 
 * @param deviceId - Device UUID
 */
export const deletePrivateKey = async (deviceId: string): Promise<void> => {
  try {
    if (!deviceId) {
      throw new Error("Device ID is required");
    }

    const keyPath = `${KEYS_DIR}/${deviceId}.pem`;
    const file = Bun.file(keyPath);

    if (await file.exists()) {
      const { unlink } = await import("fs/promises");
      await unlink(keyPath);
    }
  } catch (error) {
    throw new Error(`Failed to delete private key: ${error instanceof Error ? error.message : String(error)}`);
  }
};
