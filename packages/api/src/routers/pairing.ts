import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

import { db } from "@auxlink/db";
import { device, pairingSession, devicePairing } from "@auxlink/db/schema/index";
import { protectedProcedure, router } from "../index";
import { emitAppEvent } from "../lib/event-emitter";
import { EventTypes } from "../lib/events";

export const pairingRouter = router({
  // Initiate pairing session (TUI generates QR code)
  initiate: protectedProcedure
    .input(
      z.object({
        tuiDeviceId: z.string().uuid(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { tuiDeviceId } = input;
      const userId = ctx.session.user.id;

      // Verify TUI device belongs to user
      const tuiDevice = await db.query.device.findFirst({
        where: and(eq(device.id, tuiDeviceId), eq(device.userId, userId)),
      });

      if (!tuiDevice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "TUI device not found",
          cause: "Invalid device ID or not owned by user",
        });
      }

      if (tuiDevice.deviceType !== "tui") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Device is not a TUI",
          cause: "Only TUI devices can initiate pairing",
        });
      }

      // Create pairing session
      const sessionId = randomUUID();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

      // QR payload contains only session ID
      const qrPayload = JSON.stringify({
        sessionId,
        version: 1,
      });

      await db.insert(pairingSession).values({
        id: sessionId,
        tuiDeviceId,
        qrCodePayload: qrPayload,
        status: "pending",
        expiresAt,
      });

      return {
        sessionId,
        qrPayload,
        expiresAt,
      };
    }),

  // Complete pairing (Mobile scans QR and completes pairing)
  complete: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        mobileDeviceId: z.string().uuid(),
        mobilePublicKey: z.string(), // RSA public key in PEM format
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { sessionId, mobileDeviceId, mobilePublicKey } = input;
      const userId = ctx.session.user.id;

      // Verify mobile device belongs to user
      const mobileDevice = await db.query.device.findFirst({
        where: and(eq(device.id, mobileDeviceId), eq(device.userId, userId)),
      });

      if (!mobileDevice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Mobile device not found",
          cause: "Invalid device ID or not owned by user",
        });
      }

      if (mobileDevice.deviceType !== "mobile") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Device is not mobile",
          cause: "Only mobile devices can complete pairing",
        });
      }

      // Get pairing session
      const session = await db.query.pairingSession.findFirst({
        where: eq(pairingSession.id, sessionId),
        with: {
          tuiDevice: true,
        },
      });

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pairing session not found",
          cause: "Invalid session ID",
        });
      }

      // Check if session is expired
      if (new Date() > session.expiresAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Pairing session expired",
          cause: "QR code expired after 5 minutes",
        });
      }

      // Check if session is already completed
      if (session.status === "completed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Pairing session already completed",
        });
      }

      // Verify TUI device belongs to same user
      if (session.tuiDevice.userId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "TUI device belongs to different user",
        });
      }

      // Update mobile device with public key
      await db
        .update(device)
        .set({
          publicKey: mobilePublicKey,
          lastSeenAt: new Date(),
        })
        .where(eq(device.id, mobileDeviceId));

      // Create device pairing
      const pairingId = randomUUID();
      await db.insert(devicePairing).values({
        id: pairingId,
        mobileDeviceId,
        tuiDeviceId: session.tuiDeviceId,
        isActive: true,
      });

      // Update pairing session status
      await db
        .update(pairingSession)
        .set({
          status: "completed",
          completedAt: new Date(),
        })
        .where(eq(pairingSession.id, sessionId));

      // Emit PAIRING_COMPLETED event to TUI device
      emitAppEvent(session.tuiDeviceId, {
        type: EventTypes.PAIRING_COMPLETED,
        deviceId: session.tuiDeviceId,
        mobileDevice: {
          id: mobileDevice.id,
          name: mobileDevice.name,
          publicKey: mobilePublicKey,
        },
      });

      return {
        tuiDeviceId: session.tuiDeviceId,
        tuiPublicKey: session.tuiDevice.publicKey,
        tuiDeviceName: session.tuiDevice.name,
      };
    }),

  // Get pairing session status (TUI polls for completion)
  getStatus: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { sessionId } = input;
      const userId = ctx.session.user.id;

      // Get pairing session
      const session = await db.query.pairingSession.findFirst({
        where: eq(pairingSession.id, sessionId),
        with: {
          tuiDevice: true,
        },
      });

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pairing session not found",
        });
      }

      // Verify TUI device belongs to user
      if (session.tuiDevice.userId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Access denied",
        });
      }

      // Check if expired
      if (new Date() > session.expiresAt && session.status !== "completed") {
        // Update status to expired
        await db
          .update(pairingSession)
          .set({ status: "expired" })
          .where(eq(pairingSession.id, sessionId));

        return {
          status: "expired" as const,
          expiresAt: session.expiresAt,
        };
      }

      // If completed, get mobile device info
      if (session.status === "completed") {
        const pairing = await db.query.devicePairing.findFirst({
          where: eq(devicePairing.tuiDeviceId, session.tuiDeviceId),
          with: {
            mobileDevice: true,
          },
          orderBy: (devicePairing, { desc }) => [desc(devicePairing.pairedAt)],
        });

        return {
          status: "completed" as const,
          mobileDevice: pairing?.mobileDevice
            ? {
                id: pairing.mobileDevice.id,
                name: pairing.mobileDevice.name,
                publicKey: pairing.mobileDevice.publicKey,
              }
            : undefined,
        };
      }

      return {
        status: session.status as "pending" | "scanned",
        expiresAt: session.expiresAt,
      };
    }),

  // Cancel pairing session (TUI cancels pairing)
  cancel: protectedProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { sessionId } = input;
      const userId = ctx.session.user.id;

      // Get pairing session
      const session = await db.query.pairingSession.findFirst({
        where: eq(pairingSession.id, sessionId),
        with: {
          tuiDevice: true,
        },
      });

      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pairing session not found",
        });
      }

      // Verify TUI device belongs to user
      if (session.tuiDevice.userId !== userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Access denied",
        });
      }

      // Update status to expired (cancelled)
      await db
        .update(pairingSession)
        .set({ status: "expired" })
        .where(eq(pairingSession.id, sessionId));

      return { success: true };
    }),
});
