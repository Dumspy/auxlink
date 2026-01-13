# Agent Guidelines for auxlink

## Build/Lint/Test Commands
- **Build**: `turbo build` (all) or `turbo -F <package> build` (specific package: server, native, @auxlink/db, etc.)
- **Type check**: `turbo check-types` (all) or `turbo -F <package> check-types`
- **Dev**: `bun run dev` (all), `bun run dev:server`, `bun run dev:native`, or `turbo -F <package> dev`
- **Package manager**: Use `bun` exclusively (not npm/yarn/pnpm)
- **Database**: `bun run db:push` (apply schema), `bun run db:studio` (UI), `bun run db:local` (local SQLite)
- **Tests**: No test suite exists currently

## Code Style Guidelines

### Imports
- Use named imports: `import { x, y } from "module"` (exception: `import z from "zod"`)
- Use `import type` for type-only imports: `import type { Context } from "./context"`
- Import order: external deps → blank line → @auxlink/* packages → relative imports

### Types & Naming
- **camelCase**: variables, functions, object properties (`createContext`, `appRouter`)
- **PascalCase**: types, interfaces, classes (`Context`, `AppRouter`, `TRPCError`)
- **SCREAMING_SNAKE_CASE**: environment variables (`NODE_ENV`, `DATABASE_URL`)
- Explicit types for exports: `export type AppRouter = typeof appRouter`
- Inferred types elsewhere (function returns, const declarations)

### Functions & Patterns
- Prefer arrow functions: `const fn = async () => {}`
- Use async/await for database operations: `await db.select().from(user)`
- Method chaining for tRPC: `.input(z.object({...})).mutation(async ({ input }) => {...})`
- Destructure parameters: `async ({ input, ctx }) => {}`

### Error Handling
- Throw structured errors: `throw new TRPCError({ code: "UNAUTHORIZED", message: "...", cause: "..." })`
- Guard clauses before errors: `if (!ctx.session) { throw ... }`
- Rely on framework error boundaries (no manual try/catch unless necessary)
- Validate inputs with Zod schemas

## Project Context
- **Monorepo**: Turborepo with apps/* (server, native, tui) and packages/* (api, auth, db, config, env)
- **Stack**: Bun runtime, Elysia backend, tRPC API, Drizzle ORM, SQLite/Turso, Better-Auth, React Native (Expo)
- **Workspace commands**: Use `turbo -F <package>` for scoped operations (e.g., `turbo -F native dev`)
- **Key packages**: @auxlink/api (business logic), @auxlink/auth (Better-Auth config), @auxlink/db (Drizzle schema)
