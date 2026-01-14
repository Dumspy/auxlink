const LOG_DIR = `${Bun.env.HOME}/.auxlink`;
const LOG_FILE = `${LOG_DIR}/tui-debug.log`;

function formatTimestamp(): string {
  const now = new Date();
  return now.toISOString();
}

async function writeToFile(level: string, ...args: any[]) {
  try {
    const timestamp = formatTimestamp();
    const message = args
      .map((arg) => {
        if (typeof arg === "object") {
          try {
            return JSON.stringify(arg, Object.getOwnPropertyNames(arg), 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(" ");
    
    const logLine = `[${timestamp}] [${level}] ${message}\n`;
    
    // Read existing content and append
    const file = Bun.file(LOG_FILE);
    const existingContent = (await file.exists()) ? await file.text() : "";
    await Bun.write(LOG_FILE, existingContent + logLine);
  } catch (error) {
    // Fallback to console if file writing fails
    console.error("Failed to write to log file:", error);
  }
}

export const logger = {
  log(...args: any[]) {
    console.log(...args);
    writeToFile("INFO", ...args).catch(() => {});
  },
  error(...args: any[]) {
    console.error(...args);
    writeToFile("ERROR", ...args).catch(() => {});
  },
  warn(...args: any[]) {
    console.warn(...args);
    writeToFile("WARN", ...args).catch(() => {});
  },
  info(...args: any[]) {
    console.info(...args);
    writeToFile("INFO", ...args).catch(() => {});
  },
  debug(...args: any[]) {
    console.debug(...args);
    writeToFile("DEBUG", ...args).catch(() => {});
  },
  getLogPath() {
    return LOG_FILE;
  },
  clearLog() {
    Bun.write(LOG_FILE, "").catch((error) => {
      console.error("Failed to clear log file:", error);
    });
  },
};

// Log the file location on startup
logger.log("=".repeat(80));
logger.log("TUI Debug Log Started");
logger.log("Log file location:", LOG_FILE);
logger.log("=".repeat(80));
