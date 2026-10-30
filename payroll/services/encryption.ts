import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 12 bytes recommended for AES-GCM

function getEncryptionKey(): Buffer {
  const rawKey = process.env.PAYROLL_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || "realty-smartz-hrms-fallback-secret-key-32";
  return crypto.createHash("sha256").update(rawKey).digest();
}

/**
 * Encrypts sensitive bank account numbers using AES-256-GCM.
 * Output format: iv_hex:auth_tag_hex:ciphertext_hex
 */
export function encryptAccountNumber(plainText: string): string {
  if (!plainText) return "";
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted bank account number on the backend.
 * Only called during server-side payout execution or admin bank file CSV export.
 */
export function decryptAccountNumber(encryptedString: string): string {
  if (!encryptedString) return "";
  const parts = encryptedString.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted account number format");
  }

  const [ivHex, authTagHex, cipherTextHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(cipherTextHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Produces a masked account number representation for safe frontend rendering and logging.
 * Format: XXXXXX followed by the last 4 digits (e.g. "XXXXXX1234").
 */
export function maskAccountNumber(accountNumber: string): string {
  if (!accountNumber) return "";
  const clean = accountNumber.trim();
  if (clean.length <= 4) {
    return "X".repeat(Math.max(1, clean.length - 1)) + clean.slice(-1);
  }
  const lastFour = clean.slice(-4);
  return `XXXXXX${lastFour}`;
}

/**
 * Validates Indian Financial System Code (IFSC) format:
 * Exactly 11 characters: 4 alphabetic characters, followed by '0', followed by 6 alphanumeric characters.
 */
export function isValidIFSC(ifsc: string): boolean {
  if (!ifsc) return false;
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  return ifscRegex.test(ifsc.trim().toUpperCase());
}

/**
 * Validates bank account number format:
 * Numeric only, between 9 and 18 digits.
 */
export function isValidAccountNumber(accountNumber: string): boolean {
  if (!accountNumber) return false;
  const accRegex = /^\d{9,18}$/;
  return accRegex.test(accountNumber.trim());
}

