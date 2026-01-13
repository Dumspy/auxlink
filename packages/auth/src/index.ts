import { db } from "@auxlink/db";
import * as schema from "@auxlink/db/schema/auth";
import { env } from "@auxlink/env/server";
import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",

    schema: schema,
  }),
  trustedOrigins: env.NODE_ENV === "development" 
    ? ["*"] // Allow all origins in development (including CLI clients with no origin)
    : [
        env.CORS_ORIGIN,
        "mybettertapp://",
        "exp://",
      ],
  emailAndPassword: {
    enabled: true,
  },
  advanced: {
    defaultCookieAttributes: {
      sameSite: env.NODE_ENV === "development" ? "lax" : "none",
      secure: env.NODE_ENV !== "development",
      httpOnly: true,
    },
  },
  plugins: [expo()],
});
