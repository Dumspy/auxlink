import type { AppRouter } from "@auxlink/api/routers/index";

import { env } from "@auxlink/env/native";
import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink, httpSubscriptionLink, splitLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { Platform } from "react-native";
import EventSource from "react-native-sse";

import { authClient } from "@/lib/auth-client";

export const queryClient = new QueryClient();

// Custom EventSource class that adds auth headers
class AuthenticatedEventSource extends EventSource {
  constructor(url: string, eventSourceInitDict?: any) {
    console.log("[trpc] Creating AuthenticatedEventSource for:", url);
    console.log("[trpc] EventSource init dict:", eventSourceInitDict);
    
    // Get auth cookies
    let headers: Record<string, string> = {};
    if (Platform.OS !== "web") {
      try {
        const cookies = authClient.getCookie();
        if (cookies) {
          headers.Cookie = cookies;
          console.log("[trpc] Adding cookie header to EventSource");
        } else {
          console.warn("[trpc] No cookies found for EventSource");
        }
      } catch (error) {
        console.warn("[trpc] Failed to get cookies:", error);
      }
    }
    
    console.log("[trpc] Final headers for EventSource:", headers);
    
    // Call parent constructor with merged headers
    super(url, {
      ...eventSourceInitDict,
      headers: {
        ...eventSourceInitDict?.headers,
        ...headers,
      },
    });
    
    // Add event listeners to debug
    this.addEventListener('open', () => {
      console.log("[trpc] EventSource connection opened");
    });
    
    this.addEventListener('error', (event) => {
      console.error("[trpc] EventSource error event:", event);
    });
    
    console.log("[trpc] EventSource created successfully");
  }
}

const trpcClient = createTRPCClient<AppRouter>({
  links: [
    splitLink({
      // Use httpSubscriptionLink with SSE for subscriptions
      condition: (op) => op.type === "subscription",
      true: httpSubscriptionLink({
        url: `${env.EXPO_PUBLIC_SERVER_URL}/trpc`,
        // @ts-expect-error - Custom EventSource with auth headers
        EventSource: AuthenticatedEventSource,
      }),
      // Use httpBatchLink for queries and mutations
      false: httpBatchLink({
        url: `${env.EXPO_PUBLIC_SERVER_URL}/trpc`,
        headers() {
          const headers = new Map<string, string>();
          
          // Only try to get cookies synchronously on native platforms
          // On web, cookies are handled automatically by the browser
          if (Platform.OS !== "web") {
            try {
              const cookies = authClient.getCookie();
              if (cookies) {
                headers.set("Cookie", cookies);
              }
            } catch (error) {
              console.warn("Failed to get cookies:", error);
            }
          }
          
          return Object.fromEntries(headers);
        },
        fetch(url, options) {
          // On web, include credentials to send cookies
          const fetchOptions = Platform.OS === "web" 
            ? { ...options, credentials: "include" as RequestCredentials }
            : options;
          
          return fetch(url, fetchOptions);
        },
      }),
    }),
  ],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
});

// Export trpc client for direct mutation calls
export { trpcClient };

