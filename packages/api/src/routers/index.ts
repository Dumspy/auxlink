import { protectedProcedure, publicProcedure, router } from "../index";
import { deviceRouter } from "./device";
import { messageRouter } from "./message";
import { testRouter } from "./test"; // WARNING: Remove before production

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
  test: testRouter, // WARNING: Development only - remove before production
});
export type AppRouter = typeof appRouter;
