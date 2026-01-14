const CONFIG_DIR = `${Bun.env.HOME}/.auxlink`;
const AUTH_FILE = `${CONFIG_DIR}/auth.json`;

export const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const file = Bun.file(AUTH_FILE);
      if (!(await file.exists())) {
        console.log(`[Storage] Auth file doesn't exist`);
        return null;
      }
      const data = await file.json();
      const value = data[key] ?? null;
      console.log(`[Storage] Read key: ${key}, found: ${!!value}`);
      return value;
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      console.log(`[Storage] Writing key: ${key}`);
      let data: Record<string, string> = {};

      const file = Bun.file(AUTH_FILE);
      if (await file.exists()) {
        try {
          data = await file.json();
        } catch {}
      }

      data[key] = value;
      await Bun.write(AUTH_FILE, JSON.stringify(data, null, 2));
      console.log(`[Storage] Successfully wrote ${key}`);
    } catch (error) {
      console.error("Failed to save auth data:", error);
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      const file = Bun.file(AUTH_FILE);
      if (!(await file.exists())) {
        return;
      }
      console.log(`[Storage] Removing key: ${key}`);
      const data = await file.json();
      delete data[key];
      await Bun.write(AUTH_FILE, JSON.stringify(data, null, 2));
      console.log(`[Storage] Successfully removed ${key}`);
    } catch {}
  },
};
