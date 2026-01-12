import { env } from "@auxlink/env/tui";
import { createAuthClient } from "better-auth/react";
import { storage } from "./storage";

export const authClient = createAuthClient({
  baseURL: env.PUBLIC_SERVER_URL,
  storage: storage,
});

export async function getSession() {
  try {
    const session = await authClient.getSession();
    return session.data;
  } catch {
    return null;
  }
}
