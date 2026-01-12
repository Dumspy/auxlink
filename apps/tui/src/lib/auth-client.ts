import { env } from "@auxlink/env/tui";
import { createAuthClient } from "better-auth/react";
import { storage } from "./storage";

export const authClient = createAuthClient({
  baseURL: env.PUBLIC_SERVER_URL,
  fetchOptions: {
    // Inject stored session token as cookie header
    onRequest: async (context) => {
      const sessionToken = storage.getItem("better-auth.session_token");
      if (sessionToken) {
        // Add cookie header to all requests
        const headers = new Headers(context.headers);
        headers.set("Cookie", `better-auth.session_token=${sessionToken}`);
        return {
          ...context,
          headers,
        };
      }
      return context;
    },
    // Capture session tokens from responses
    onResponse: async (context) => {
      const setCookieHeader = context.response.headers.get("set-cookie");
      if (setCookieHeader) {
        // Extract session token from Set-Cookie header
        const sessionTokenMatch = setCookieHeader.match(/better-auth\.session_token=([^;]+)/);
        if (sessionTokenMatch && sessionTokenMatch[1]) {
          const token = sessionTokenMatch[1];
          // Store the token
          storage.setItem("better-auth.session_token", token);
          console.log("[Auth] Session token stored");
        }
      }
      return context.response;
    },
    // Handle errors (token expiration, etc.)
    onError: async (context) => {
      if (context.response?.status === 401) {
        // Clear invalid token
        storage.removeItem("better-auth.session_token");
        console.log("[Auth] Session token cleared (unauthorized)");
      }
    },
  },
});

export async function getSession() {
  try {
    const session = await authClient.getSession();
    return session.data;
  } catch {
    return null;
  }
}
