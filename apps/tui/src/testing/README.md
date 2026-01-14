# TUI Testing Scripts

This directory contains development and testing scripts for the AuxLink TUI application.

## Scripts

### `device-debug.ts`
Check device registration status and list all devices for the current user.

```bash
PUBLIC_SERVER_URL=http://localhost:3000 bun run apps/tui/src/testing/device-debug.ts
```

### `test-message-send.ts`
Send a test message from one device to another using the actual message router.

```bash
PUBLIC_SERVER_URL=http://localhost:3000 bun run apps/tui/src/testing/test-message-send.ts \
  "<sender-device-id>" \
  "<recipient-device-id>" \
  "Your message here"
```

**Example:**
```bash
PUBLIC_SERVER_URL=http://localhost:3000 bun run apps/tui/src/testing/test-message-send.ts \
  "aac1844f-0652-4500-ad23-a07662bd1ae0" \
  "7f7b6b5b-72e4-490d-9d40-8a20d32d0373" \
  "Hello from mobile!"
```

### `test-message-trigger.ts`
Trigger a test message event without storing in database (uses test router).

```bash
PUBLIC_SERVER_URL=http://localhost:3000 bun run apps/tui/src/testing/test-message-trigger.ts \
  "<recipient-device-id>" \
  "Test message"
```

### `test-echo-trigger.ts`
Trigger an echo event to test SSE connectivity (uses test router).

```bash
PUBLIC_SERVER_URL=http://localhost:3000 bun run apps/tui/src/testing/test-echo-trigger.ts \
  "<device-id>" \
  "Echo message"
```

### `test-check-listeners.ts`
Check EventEmitter listener status (diagnostic tool).

```bash
PUBLIC_SERVER_URL=http://localhost:3000 bun run apps/tui/src/testing/test-check-listeners.ts
```

## Prerequisites

- Server must be running (`bun run dev:server`)
- You must be logged in to the TUI (to have a valid session token)
- Device IDs can be found using `device-debug.ts`

## Notes

- All scripts use the session token from `~/.auxlink/storage.json`
- Logs are written to `~/.auxlink/tui-debug.log`
- Scripts that use the test router (`test-echo-trigger.ts`, `test-message-trigger.ts`) require the test router to be enabled in the API
