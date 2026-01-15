import { protectedProcedure, publicProcedure, router } from "../index";
import { deviceRouter } from "./device";
import { messageRouter } from "./message";
import { pairingRouter } from "./pairing";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  privateData: protectedProcedure.query(({ ctx }) => {
    return {
      message: "This is private",
      user: ctx.session.user,
    };
  }),
  device: deviceRouter,
  message: messageRouter,
  pairing: pairingRouter,
});
export type AppRouter = typeof appRouter;
