import { createContext } from "@auxlink/api/context";
import { appRouter } from "@auxlink/api/routers/index";
import { auth } from "@auxlink/auth";
import { env } from "@auxlink/env/server";
import { cors } from "@elysiajs/cors";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { Elysia } from "elysia";

new Elysia()
  .use(
    cors({
      origin: (request) => {
        // In development, allow all origins (including null/missing origin for CLI clients)
        if (env.NODE_ENV === "development") {
          return true;
        }
        // In production, check against allowed origins
        const origin = request.headers.get("origin");
        if (!origin) {
          // Allow requests without origin (CLI tools, server-to-server)
          return true;
        }
        // Check against configured CORS origins
        const allowedOrigins = env.CORS_ORIGIN.split(",");
        return allowedOrigins.includes(origin);
      },
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
      credentials: true,
      exposeHeaders: ["Set-Cookie"],
    }),
  )
  .all("/api/auth/*", async (context) => {
    const { request, status } = context;
    if (["POST", "GET"].includes(request.method)) {
      return auth.handler(request);
    }
    return status(405);
  })
  .all("/trpc/*", async (context) => {
    const res = await fetchRequestHandler({
      endpoint: "/trpc",
      router: appRouter,
      req: context.request,
      createContext: () => createContext({ context }),
    });
    return res;
  })
  .get("/", () => "OK")
  .listen(3000, () => {
    console.log("Server is running on http://localhost:3000");
  });
