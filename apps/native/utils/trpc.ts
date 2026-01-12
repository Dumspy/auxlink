import type { AppRouter } from "@auxlink/api/routers/index";

import { env } from "@auxlink/env/native";
import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { Platform } from "react-native";

import { authClient } from "@/lib/auth-client";

export const queryClient = new QueryClient();

const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
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
  ],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
});


