import type { AppRouter } from "@auxlink/api/routers/index";
import { env } from "@auxlink/env/tui";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { storage } from "@/lib/storage";

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${env.PUBLIC_SERVER_URL}/trpc`,
      headers() {
        try {
          // Get session token from storage and construct cookie header
          const sessionToken = storage.getItem("better-auth.session_token");
          if (sessionToken) {
            return { Cookie: `better-auth.session_token=${sessionToken}` };
          }
        } catch (error) {
          console.warn("Failed to get session token:", error);
        }
        return {};
      },
    }),
  ],
});
