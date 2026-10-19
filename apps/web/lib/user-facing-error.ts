const GENERIC_ERROR = "Something went wrong. Please try again.";

function firstValidationMessage(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const message = firstValidationMessage(item);
      if (message) return message;
    }
    return null;
  }

  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.message === "string" && record.message.trim()) {
    return record.message.trim();
  }

  return (
    firstValidationMessage(record.issues) ??
    firstValidationMessage(record.errors) ??
    firstValidationMessage(record.fieldErrors)
  );
}

export function userFacingErrorMessage(
  error: unknown,
  fallback = GENERIC_ERROR
): string {
  const raw =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";

  if (!raw.trim()) return fallback;

  const trimmed = raw.trim();
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      return firstValidationMessage(JSON.parse(trimmed)) ?? fallback;
    } catch {
      return fallback;
    }
  }

  if (
    /\b(?:PrismaClient|Prisma|TypeError|ReferenceError|SyntaxError|Error:|node_modules|SELECT\s|INSERT\s|UPDATE\s|DELETE\s|P\d{4})\b/i.test(
      trimmed
    ) ||
    /^\s*at\s/m.test(trimmed)
  ) {
    return fallback;
  }

  return trimmed;
}
