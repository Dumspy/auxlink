import type { AppRouter } from "@auxlink/api/routers/index";
import { env } from "@auxlink/env/tui";
import { createTRPCClient, httpBatchLink, httpSubscriptionLink, splitLink } from "@trpc/client";
import { storage } from "@/lib/storage";
import { logger } from "@/lib/logger";

logger.log("[trpc] TUI tRPC client initializing...");
logger.log("[trpc] Server URL:", env.PUBLIC_SERVER_URL);

// Wrapper class for native EventSource that manually adds cookie via fetch
class CookieEventSource extends EventTarget {
  private es: EventSource | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private abortController: AbortController | null = null;
  public readyState: number = 0;
  public url: string = "";
  
  constructor(url: string, config?: any) {
    super();
    this.url = url;
    logger.log("[trpc] Creating CookieEventSource for:", url);
    
    // Get cookie from storage
    let cookieHeader = "";
    
    // Store the promise to get session token
    storage.getItem("better-auth.session_token").then(sessionToken => {
      if (sessionToken) {
        cookieHeader = `better-auth.session_token=${sessionToken}`;
        logger.log("[trpc] Cookie will be sent:", cookieHeader);
      }
      
      // Use fetch to establish connection with cookie header
      this.readyState = 0; // CONNECTING
      this.abortController = new AbortController();
      this.startFetch(url, cookieHeader);
    }).catch(error => {
      logger.error("[trpc] Failed to get session token:", error);
      // Still try to start fetch without cookie
      this.readyState = 0; // CONNECTING
      this.abortController = new AbortController();
      this.startFetch(url, cookieHeader);
    });
  }
  
  private async startFetch(url: string, cookie: string) {
    try {
      logger.log("[trpc] Starting fetch with cookie");
      const response = await fetch(url, {
        headers: {
          "Accept": "text/event-stream",
          "Cache-Control": "no-cache",
          "Cookie": cookie,
        },
        signal: this.abortController!.signal,
      });
      
      logger.log("[trpc] Fetch response status:", response.status);
      logger.log("[trpc] Fetch response content-type:", response.headers.get("content-type"));
      
      if (!response.ok) {
        logger.error("[trpc] Fetch failed with status:", response.status);
        const text = await response.text();
        logger.error("[trpc] Response body:", text);
        this.readyState = 2; // CLOSED
        this.dispatchEvent(new Event("error"));
        return;
      }
      
      this.readyState = 1; // OPEN
      this.dispatchEvent(new Event("open"));
      
      // Read the SSE stream
      this.reader = response.body?.getReader() || null;
      const decoder = new TextDecoder();
      
      if (!this.reader) {
        logger.error("[trpc] No reader available");
        return;
      }
      
      let buffer = "";
      while (this.readyState !== 2) {
        const { done, value } = await this.reader.read();
        if (done) {
          logger.log("[trpc] Stream ended");
          this.readyState = 2; // CLOSED
          break;
        }
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        
        // Log raw buffer content for debugging
        if (lines.length > 0 && this.url.includes("message.onMessage")) {
          logger.log("[trpc] [message.onMessage] Processing lines:", lines);
        }
        
        let eventType = "message";
        let eventData = "";
        let eventId = "";
        
        for (const line of lines) {
          if (this.readyState === 2) break; // Stop processing if closed
          
          // Handle SSE format: event, data, id fields
          if (line.startsWith("event: ")) {
            eventType = line.slice(7);
          } else if (line.startsWith("data: ")) {
            eventData = line.slice(6);
          } else if (line.startsWith("id: ")) {
            eventId = line.slice(4);
          } else if (line === "") {
            // Empty line = end of event, dispatch it
            if (eventData) {
              logger.log("[trpc] Received SSE data:", eventData);
              const event = new MessageEvent(eventType, { 
                data: eventData,
                lastEventId: eventId 
              });
              this.dispatchEvent(event);
              // Reset for next event
              eventType = "message";
              eventData = "";
              eventId = "";
            }
          }
        }
      }
    } catch (error: any) {
      // Ignore abort errors when closing intentionally
      if (error.name === 'AbortError') {
        logger.log("[trpc] Fetch aborted (normal on close)");
      } else {
        logger.error("[trpc] Fetch error:", error);
      }
      this.readyState = 2; // CLOSED
      this.dispatchEvent(new Event("error"));
    }
  }
  
  close() {
    logger.log("[trpc] Closing EventSource");
    this.readyState = 2; // CLOSED
    
    // Abort the fetch request
    if (this.abortController) {
      this.abortController.abort();
    }
    
    // Cancel the reader if it exists
    if (this.reader) {
      this.reader.cancel().catch(() => {
        // Ignore cancel errors
      });
      this.reader = null;
    }
  }
}

export const trpc = createTRPCClient<AppRouter>({
  links: [
    splitLink({
      // Use httpSubscriptionLink with SSE for subscriptions
      condition: (op) => op.type === "subscription",
      true: httpSubscriptionLink({
        url: `${env.PUBLIC_SERVER_URL}/trpc`,
        // @ts-expect-error - Custom EventSource implementation
        EventSource: CookieEventSource,
      }),
      // Use httpBatchLink for queries and mutations
      false: httpBatchLink({
        url: `${env.PUBLIC_SERVER_URL}/trpc`,
        async headers() {
          try {
            // Get session token from storage and construct cookie header
            const sessionToken = await storage.getItem("better-auth.session_token");
            if (sessionToken) {
              return { Cookie: `better-auth.session_token=${sessionToken}` };
            }
          } catch (error) {
            console.warn("Failed to get session token:", error);
          }
          return {};
        },
      }),
    }),
  ],
});
