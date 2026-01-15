import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

import { db } from "@auxlink/db";
import { device, devicePairing } from "@auxlink/db/schema/index";
import { protectedProcedure, router } from "../index";
import { generateDeviceName } from "../utils/device-name";

export const deviceRouter = router({
  // Register a new device (idempotent by default - returns existing if found)
  register: protectedProcedure
    .input(
      z.object({
        deviceType: z.enum(["mobile", "tui"]),
        userAgent: z.string().optional(),
        publicKey: z.string().optional(),
        // Optional: provide existing device ID to update instead of create
        deviceId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { deviceType, userAgent, publicKey, deviceId } = input;
      const userId = ctx.session.user.id;

      // If deviceId provided, update existing device
      if (deviceId) {
        const existingDevice = await db.query.device.findFirst({
          where: and(eq(device.id, deviceId), eq(device.userId, userId)),
        });

        if (!existingDevice) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Device not found",
            cause: "Invalid device ID or not owned by user",
          });
        }

        // Update lastSeenAt and optionally publicKey
        const [updatedDevice] = await db
          .update(device)
          .set({
            lastSeenAt: new Date(),
            ...(publicKey && { publicKey }),
          })
          .where(eq(device.id, deviceId))
          .returning();

        return updatedDevice;
      }

      // Create new device
      const id = randomUUID();
      const name = generateDeviceName(userAgent || "", deviceType);

      const [newDevice] = await db
        .insert(device)
        .values({
          id,
          userId,
          deviceType,
          name,
          publicKey: publicKey || null,
          lastSeenAt: new Date(),
        })
        .returning();

      return newDevice;
    }),

  // List all devices for current user
  list: protectedProcedure
    .input(
      z
        .object({
          deviceType: z.enum(["mobile", "tui"]).optional(),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const userId = ctx.session.user.id;

      const devices = await db.query.device.findMany({
        where: input?.deviceType
          ? and(eq(device.userId, userId), eq(device.deviceType, input.deviceType))
          : eq(device.userId, userId),
        orderBy: (device, { desc }) => [desc(device.lastSeenAt)],
      });

      return devices;
    }),

  // Get devices paired with a specific device
  getPaired: protectedProcedure
    .input(
      z.object({
        deviceId: z.string().uuid(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { deviceId } = input;
      const userId = ctx.session.user.id;

      // Verify device belongs to user
      const userDevice = await db.query.device.findFirst({
        where: and(eq(device.id, deviceId), eq(device.userId, userId)),
      });

      if (!userDevice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Device not found",
          cause: "Invalid device ID or not owned by user",
        });
      }

      // Find paired devices based on device type
      let pairedDevices: typeof device.$inferSelect[] = [];

      if (userDevice.deviceType === "mobile") {
        // Get all TUIs paired with this mobile device
        const pairings = await db.query.devicePairing.findMany({
          where: and(
            eq(devicePairing.mobileDeviceId, deviceId),
            eq(devicePairing.isActive, true)
          ),
          with: {
            tuiDevice: true,
          },
        });
        pairedDevices = pairings.map((p) => p.tuiDevice);
      } else {
        // Get mobile device paired with this TUI
        const pairing = await db.query.devicePairing.findFirst({
          where: and(
            eq(devicePairing.tuiDeviceId, deviceId),
            eq(devicePairing.isActive, true)
          ),
          with: {
            mobileDevice: true,
          },
        });
        if (pairing) {
          pairedDevices = [pairing.mobileDevice];
        }
      }

      return pairedDevices;
    }),

  // Update device lastSeenAt
  updateLastSeen: protectedProcedure
    .input(
      z.object({
        deviceId: z.string().uuid(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { deviceId } = input;
      const userId = ctx.session.user.id;

      // Verify device belongs to user
      const userDevice = await db.query.device.findFirst({
        where: and(eq(device.id, deviceId), eq(device.userId, userId)),
      });

      if (!userDevice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Device not found",
        });
      }

      await db.update(device).set({ lastSeenAt: new Date() }).where(eq(device.id, deviceId));

      return { success: true };
    }),

  // Delete a device (and all its pairings)
  delete: protectedProcedure
    .input(
      z.object({
        deviceId: z.string().uuid(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { deviceId } = input;
      const userId = ctx.session.user.id;

      // Verify device belongs to user
      const userDevice = await db.query.device.findFirst({
        where: and(eq(device.id, deviceId), eq(device.userId, userId)),
      });

      if (!userDevice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Device not found",
          cause: "Invalid device ID or not owned by user",
        });
      }

      // Delete device (cascade will delete pairings, messages, sessions)
      await db.delete(device).where(eq(device.id, deviceId));

      return { success: true };
    }),

  // Unpair devices (set isActive to false, keeping history)
  unpair: protectedProcedure
    .input(
      z.object({
        mobileDeviceId: z.string().uuid(),
        tuiDeviceId: z.string().uuid(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { mobileDeviceId, tuiDeviceId } = input;
      const userId = ctx.session.user.id;

      // Verify both devices belong to user
      const [mobileDevice, tuiDevice] = await Promise.all([
        db.query.device.findFirst({
          where: and(eq(device.id, mobileDeviceId), eq(device.userId, userId)),
        }),
        db.query.device.findFirst({
          where: and(eq(device.id, tuiDeviceId), eq(device.userId, userId)),
        }),
      ]);

      if (!mobileDevice || !tuiDevice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "One or both devices not found",
        });
      }

      // Set pairing to inactive
      await db
        .update(devicePairing)
        .set({ isActive: false })
        .where(
          and(
            eq(devicePairing.mobileDeviceId, mobileDeviceId),
            eq(devicePairing.tuiDeviceId, tuiDeviceId)
          )
        );

      return { success: true };
    }),
});
