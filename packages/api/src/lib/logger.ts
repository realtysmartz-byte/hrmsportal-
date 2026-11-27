import fs from "node:fs";
import path from "node:path";

const LOG_RETENTION_DAYS = 7;
const LOG_DIR = path.resolve(process.cwd(), "logs");

let initialized = false;
let lastPrunedDate = "";

function getISTTimestamp(): { dateStr: string; isoIST: string } {
  const istMs = Date.now() + 5.5 * 60 * 60 * 1000;
  const d = new Date(istMs);
  const dateStr = d.toISOString().slice(0, 10);
  const isoIST = d.toISOString().replace("T", " ").slice(0, 23) + " IST";
  return { dateStr, isoIST };
}

function pruneOldLogs(currentDateStr: string) {
  if (lastPrunedDate === currentDateStr) return;
  lastPrunedDate = currentDateStr;
  try {
    if (!fs.existsSync(LOG_DIR)) return;
    const cutoffMs = Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(LOG_DIR);
    for (const file of files) {
      if (!file.startsWith("hrms-") || !file.endsWith(".log")) continue;
      const fullPath = path.join(LOG_DIR, file);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.mtimeMs < cutoffMs) {
          fs.unlinkSync(fullPath);
        }
      } catch {
        // Ignore individual file errors
      }
    }
  } catch {
    // Ignore directory errors on read-only hosts
  }
}

export function writeLogEntry(level: "INFO" | "WARN" | "ERROR" | "UNCAUGHT", args: unknown[]) {
  try {
    const { dateStr, isoIST } = getISTTimestamp();
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    pruneOldLogs(dateStr);

    const msg = args
      .map((a) => {
        if (a instanceof Error) return a.stack || a.message;
        if (typeof a === "string") return a;
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      })
      .join(" ");

    const logFile = path.join(LOG_DIR, `hrms-${dateStr}.log`);
    fs.appendFile(logFile, `[${isoIST}] [${level}] ${msg}\n`, () => {});
  } catch {
    // Never throw from logger
  }
}

/**
 * Initializes 7-day rotating runtime file logging for errors, warnings, and uncaught exceptions.
 * Safe to call multiple times (idempotent).
 */
export function initServerLogger() {
  if (initialized || typeof process === "undefined") return;
  initialized = true;

  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);

  console.error = (...args: unknown[]) => {
    writeLogEntry("ERROR", args);
    origError(...args);
  };

  console.warn = (...args: unknown[]) => {
    writeLogEntry("WARN", args);
    origWarn(...args);
  };

  if (!(globalThis as Record<string, unknown>).__rsLoggerHooksAttached) {
    (globalThis as Record<string, unknown>).__rsLoggerHooksAttached = true;
    process.on("uncaughtException", (err) => {
      writeLogEntry("UNCAUGHT", ["uncaughtException:", err]);
      origError("[UNCAUGHT]", err);
    });
    process.on("unhandledRejection", (reason) => {
      writeLogEntry("UNCAUGHT", ["unhandledRejection:", reason]);
      origError("[UNHANDLED_REJECTION]", reason);
    });
  }
}
