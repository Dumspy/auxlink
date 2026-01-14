// Development-only test router for SSE validation
// WARNING: Remove this router before production deployment

import { z } from "zod";
import { tracked } from "@trpc/server";
import { on } from "events";
import { protectedProcedure, router } from "../index";
import { appEventEmitter, emitAppEvent, getDeviceChannel } from "../lib/event-emitter";
import { EventTypes } from "../lib/events";

export const testRouter = router({
  // Ping subscription - emits pong every 2 seconds
  ping: protectedProcedure.subscription(async function* (opts) {
    let counter = 0;

    const interval = setInterval(() => {
      counter++;
    }, 2000);

    // Cleanup on unsubscribe
    if (opts.signal) {
      opts.signal.addEventListener("abort", () => {
        clearInterval(interval);
      });
    }

    // Yield pong events
    while (!opts.signal?.aborted) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      if (!opts.signal?.aborted) {
        yield tracked(String(counter++), {
          type: EventTypes.TEST_PING,
          timestamp: new Date(),
          message: `pong ${counter}`,
        });
      }
    }
  }),

  // Echo subscription - listens for echo events
  echo: protectedProcedure
    .input(
      z.object({
        deviceId: z.string(),
      }),
    )
    .subscription(async function* (opts) {
      const { deviceId } = opts.input;
      const channel = getDeviceChannel(deviceId);

      for await (const [event] of on(appEventEmitter, channel, {
        signal: opts.signal,
      })) {
        if (event.type === EventTypes.TEST_ECHO) {
          yield tracked(crypto.randomUUID(), event);
        }
      }
    }),

  // Trigger echo event
  triggerEcho: protectedProcedure
    .input(
      z.object({
        deviceId: z.string(),
        message: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      emitAppEvent(input.deviceId, {
        type: EventTypes.TEST_ECHO,
        deviceId: input.deviceId,
        message: input.message,
      });

      return { success: true };
    }),

  // Trigger test message
  triggerTestMessage: protectedProcedure
    .input(
      z.object({
        recipientDeviceId: z.string(),
        content: z.string().default("test message"),
      }),
    )
    .mutation(async ({ input }) => {
      const testMessage = {
        id: crypto.randomUUID(),
        senderDeviceId: "test-sender",
        recipientDeviceId: input.recipientDeviceId,
        encryptedContent: Buffer.from(input.content).toString("base64"),
        messageType: "message" as const,
        contentType: "text",
        status: "sent" as const,
        sentAt: new Date(),
        deliveredAt: null,
        readAt: null,
        expiresAt: null,
      };

      emitAppEvent(input.recipientDeviceId, {
        type: EventTypes.MESSAGE_RECEIVED,
        deviceId: input.recipientDeviceId,
        message: testMessage,
      });

      return { success: true, messageId: testMessage.id };
    }),
});
