import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CONFIG_DIR = join(homedir(), ".auxlink");
const AUTH_FILE = join(CONFIG_DIR, "auth.json");

export const storage = {
  getItem(key: string): string | null {
    try {
      if (!existsSync(AUTH_FILE)) {
        console.log(`[Storage] Auth file doesn't exist`);
        return null;
      }
      const data = JSON.parse(readFileSync(AUTH_FILE, "utf-8"));
      const value = data[key] ?? null;
      console.log(`[Storage] Read key: ${key}, found: ${!!value}`);
      return value;
    } catch {
      return null;
    }
  },

  setItem(key: string, value: string): void {
    try {
      console.log(`[Storage] Writing key: ${key}`);
      mkdirSync(CONFIG_DIR, { recursive: true });
      let data: Record<string, string> = {};

      if (existsSync(AUTH_FILE)) {
        try {
          data = JSON.parse(readFileSync(AUTH_FILE, "utf-8"));
        } catch {}
      }

      data[key] = value;
      writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2));
      console.log(`[Storage] Successfully wrote ${key}`);
    } catch (error) {
      console.error("Failed to save auth data:", error);
    }
  },

  removeItem(key: string): void {
    try {
      if (!existsSync(AUTH_FILE)) {
        return;
      }
      console.log(`[Storage] Removing key: ${key}`);
      const data = JSON.parse(readFileSync(AUTH_FILE, "utf-8"));
      delete data[key];
      writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2));
      console.log(`[Storage] Successfully removed ${key}`);
    } catch {}
  },
};
