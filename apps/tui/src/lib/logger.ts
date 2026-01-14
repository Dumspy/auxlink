import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const LOG_DIR = join(homedir(), ".auxlink");
const LOG_FILE = join(LOG_DIR, "tui-debug.log");

// Ensure log directory exists
if (!existsSync(LOG_DIR)) {
  mkdirSync(LOG_DIR, { recursive: true });
}

function formatTimestamp(): string {
  const now = new Date();
  return now.toISOString();
}

function writeToFile(level: string, ...args: any[]) {
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
    appendFileSync(LOG_FILE, logLine);
  } catch (error) {
    // Fallback to console if file writing fails
    console.error("Failed to write to log file:", error);
  }
}

export const logger = {
  log(...args: any[]) {
    console.log(...args);
    writeToFile("INFO", ...args);
  },
  error(...args: any[]) {
    console.error(...args);
    writeToFile("ERROR", ...args);
  },
  warn(...args: any[]) {
    console.warn(...args);
    writeToFile("WARN", ...args);
  },
  info(...args: any[]) {
    console.info(...args);
    writeToFile("INFO", ...args);
  },
  debug(...args: any[]) {
    console.debug(...args);
    writeToFile("DEBUG", ...args);
  },
  getLogPath() {
    return LOG_FILE;
  },
  clearLog() {
    try {
      const fs = require("node:fs");
      if (existsSync(LOG_FILE)) {
        fs.writeFileSync(LOG_FILE, "");
      }
    } catch (error) {
      console.error("Failed to clear log file:", error);
    }
  },
};

// Log the file location on startup
logger.log("=".repeat(80));
logger.log("TUI Debug Log Started");
logger.log("Log file location:", LOG_FILE);
logger.log("=".repeat(80));
