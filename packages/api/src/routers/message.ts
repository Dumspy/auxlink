import { z } from "zod";
import { and, desc, eq, gt, or } from "drizzle-orm";
import { tracked } from "@trpc/server";
import { on } from "events";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../index";
import { db } from "@auxlink/db";
import { device, message } from "@auxlink/db/schema/index";
import {
  appEventEmitter,
  emitAppEvent,
  getDeviceChannel,
} from "../lib/event-emitter";
import { EventTypes } from "../lib/events";

export const messageRouter = router({
  // SSE subscription for receiving messages
  onMessage: protectedProcedure
    .input(
      z.object({
        deviceId: z.string(),
        lastEventId: z.string().optional(),
      }),
    )
    .subscription(async function* (opts) {
      const { deviceId, lastEventId } = opts.input;
      const userId = opts.ctx.session.user.id;

      // Verify device belongs to user
      const userDevice = await db
        .select()
        .from(device)
        .where(and(eq(device.id, deviceId), eq(device.userId, userId)))
        .get();

      if (!userDevice) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Device not found or access denied",
        });
      }

      // First, yield missed messages since lastEventId
      if (lastEventId) {
        // Get the timestamp of the last received message
        const lastMessage = await db
          .select()
          .from(message)
          .where(eq(message.id, lastEventId))
          .get();

        if (lastMessage) {
          // Query messages sent after the last received message (by timestamp)
          const missedMessages = await db
            .select()
            .from(message)
            .where(
              and(
                eq(message.recipientDeviceId, deviceId),
                gt(message.sentAt, lastMessage.sentAt),
              ),
            )
            .orderBy(message.sentAt)
            .all();

          for (const msg of missedMessages) {
            yield tracked(msg.id, {
              type: EventTypes.MESSAGE_RECEIVED,
              deviceId,
              message: msg,
            });
          }
        }
      }

      // Then listen for new messages in real-time
      const channel = getDeviceChannel(deviceId);

      for await (const [event] of on(appEventEmitter, channel, {
        signal: opts.signal,
      })) {
        if (event.type === EventTypes.MESSAGE_RECEIVED) {
          yield tracked(event.message.id, event);
        }
      }
    }),

  // Send a message
  send: protectedProcedure
    .input(
      z.object({
        senderDeviceId: z.string(),
        recipientDeviceId: z.string(),
        encryptedContent: z.string(),
        messageType: z.enum(["prekey", "message"]),
        contentType: z.string().default("text"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      // Verify sender device belongs to user
      const senderDevice = await db
        .select()
        .from(device)
        .where(and(eq(device.id, input.senderDeviceId), eq(device.userId, userId)))
        .get();

      if (!senderDevice) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Sender device not found or access denied",
        });
      }

      // Create message in database
      const newMessage = await db
        .insert(message)
        .values({
          id: crypto.randomUUID(),
          senderDeviceId: input.senderDeviceId,
          recipientDeviceId: input.recipientDeviceId,
          encryptedContent: input.encryptedContent,
          messageType: input.messageType,
          contentType: input.contentType,
          status: "sent",
          sentAt: new Date(),
        })
        .returning()
        .get();

      // Emit event to recipient device
      emitAppEvent(input.recipientDeviceId, {
        type: EventTypes.MESSAGE_RECEIVED,
        deviceId: input.recipientDeviceId,
        message: newMessage,
      });

      return {
        id: newMessage.id,
        status: newMessage.status,
        sentAt: newMessage.sentAt,
      };
    }),

  // List messages for a device
  list: protectedProcedure
    .input(
      z.object({
        deviceId: z.string(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      // Verify device belongs to user
      const userDevice = await db
        .select()
        .from(device)
        .where(and(eq(device.id, input.deviceId), eq(device.userId, userId)))
        .get();

      if (!userDevice) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Device not found or access denied",
        });
      }

      // Get messages where device is sender or recipient
      const messages = await db
        .select()
        .from(message)
        .where(
          or(
            eq(message.senderDeviceId, input.deviceId),
            eq(message.recipientDeviceId, input.deviceId),
          ),
        )
        .orderBy(desc(message.sentAt))
        .limit(input.limit)
        .offset(input.offset)
        .all();

      return messages;
    }),

  // Update message status (delivery/read receipts)
  updateStatus: protectedProcedure
    .input(
      z.object({
        messageId: z.string(),
        status: z.enum(["delivered", "read"]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      // Get message and verify recipient device belongs to user
      const msg = await db
        .select({
          message,
          recipientDevice: device,
        })
        .from(message)
        .leftJoin(device, eq(message.recipientDeviceId, device.id))
        .where(eq(message.id, input.messageId))
        .get();

      if (!msg || msg.recipientDevice?.userId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Message not found or access denied",
        });
      }

      // Update message status
      const timestamp = new Date();
      const updateData: Record<string, unknown> = { status: input.status };

      if (input.status === "delivered") {
        updateData.deliveredAt = timestamp;
      } else if (input.status === "read") {
        updateData.readAt = timestamp;
      }

      const updatedMessage = await db
        .update(message)
        .set(updateData)
        .where(eq(message.id, input.messageId))
        .returning()
        .get();

      // Emit status update to sender device
      emitAppEvent(msg.message.senderDeviceId, {
        type: EventTypes.MESSAGE_STATUS_UPDATED,
        deviceId: msg.message.senderDeviceId,
        messageId: input.messageId,
        status: input.status,
        timestamp,
      });

      return updatedMessage;
    }),

  // Get pending messages (for mobile foreground sync - Phase 5)
  getPending: protectedProcedure
    .input(
      z.object({
        deviceId: z.string(),
        since: z.string().optional(), // Last message ID received
      }),
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      // Verify device belongs to user
      const userDevice = await db
        .select()
        .from(device)
        .where(and(eq(device.id, input.deviceId), eq(device.userId, userId)))
        .get();

      if (!userDevice) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Device not found or access denied",
        });
      }

      // Build query for undelivered messages
      const conditions = [
        eq(message.recipientDeviceId, input.deviceId),
        or(eq(message.status, "pending"), eq(message.status, "sent")),
      ];

      if (input.since) {
        conditions.push(gt(message.id, input.since));
      }

      const pendingMessages = await db
        .select()
        .from(message)
        .where(and(...conditions))
        .orderBy(message.sentAt)
        .all();

      return pendingMessages;
    }),
});
