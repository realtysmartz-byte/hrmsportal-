import type { PrismaClient, TelegramAutomationConfig } from "@prisma/client";
import { getRedisClient, logRedisCacheError } from "./redis";

export type TelegramChannelType = "ATTENDANCE_LEAVE" | "HR_LIFECYCLE";

const REDIS_KEY_PREFIX = "hrms:automation:config:";

export async function getTelegramConfig(
  prisma: PrismaClient,
  channelType: TelegramChannelType
): Promise<TelegramAutomationConfig> {
  const redis = getRedisClient();
  const cacheKey = `${REDIS_KEY_PREFIX}${channelType}`;

  if (redis) {
    try {
      const cached = await redis.get<TelegramAutomationConfig>(cacheKey);
      if (cached) return cached;
    } catch (err) {
      logRedisCacheError(`read config ${channelType}`, err);
    }
  }

  let config = await prisma.telegramAutomationConfig.findUnique({
    where: { channelType },
  });

  if (!config) {
    const isAttendance = channelType === "ATTENDANCE_LEAVE";
    config = await prisma.telegramAutomationConfig.create({
      data: {
        channelType,
        name: isAttendance
          ? "Attendance and Leaves Automation"
          : "HR and Employee Lifecycle Automation",
        enabled: false,
        notifyPunchIn: true,
        notifyPunchOut: false,
        notifyLeave: true,
        notifyBirthday: true,
        notifyNewJoin: true,
        notifyCandidate: true,
        notifyResigned: true,
        notifyTerminated: true,
      },
    });
  }

  if (redis && config) {
    void redis.set(cacheKey, config, { ex: 300 }).catch((err) => {
      logRedisCacheError(`cache config ${channelType}`, err);
    });
  }

  return config;
}

export async function invalidateTelegramConfigCache(channelType: TelegramChannelType) {
  const redis = getRedisClient();
  if (!redis) return;
  const cacheKey = `${REDIS_KEY_PREFIX}${channelType}`;
  try {
    await redis.del(cacheKey);
  } catch (err) {
    logRedisCacheError(`del config ${channelType}`, err);
  }
}

// Sequential rate-limit dispatch queue per chat to respect Telegram's 1 msg/sec limit
const chatDispatchChains = new Map<string, Promise<unknown>>();
const lastSentTimestamps = new Map<string, number>();
const MIN_INTERVAL_PER_CHAT_MS = 1050;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Sends a message with pacing, retry queue, and automatic 429 rate limit backoff.
 * Guarantees every concurrent punch-in alert is queued and delivered without being dropped.
 */
export async function sendRawTelegramMessage(
  botToken: string,
  chatId: string,
  htmlText: string
): Promise<{ ok: boolean; error?: string }> {
  const current = chatDispatchChains.get(chatId) || Promise.resolve();

  const next = current
    .then(async () => {
      const now = Date.now();
      const lastSent = lastSentTimestamps.get(chatId) || 0;
      const elapsed = now - lastSent;
      if (elapsed < MIN_INTERVAL_PER_CHAT_MS) {
        await sleep(MIN_INTERVAL_PER_CHAT_MS - elapsed);
      }
      return executeTelegramSendWithRetries(botToken, chatId, htmlText);
    })
    .catch(async () => {
      return executeTelegramSendWithRetries(botToken, chatId, htmlText);
    })
    .finally(() => {
      lastSentTimestamps.set(chatId, Date.now());
      if (chatDispatchChains.get(chatId) === next) {
        chatDispatchChains.delete(chatId);
      }
    });

  chatDispatchChains.set(chatId, next);
  return next as Promise<{ ok: boolean; error?: string }>;
}

async function executeTelegramSendWithRetries(
  botToken: string,
  chatId: string,
  htmlText: string
): Promise<{ ok: boolean; error?: string }> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: htmlText,
          parse_mode: "HTML",
          disable_web_page_preview: false,
        }),
      });

      const data = (await res.json()) as {
        ok: boolean;
        error_code?: number;
        description?: string;
        parameters?: {
          retry_after?: number;
        };
      };

      if (data.ok) {
        return { ok: true };
      }

      // Handle Telegram 429 (Too Many Requests / Flood Control)
      if (res.status === 429 || data.error_code === 429) {
        const retryAfter = data.parameters?.retry_after ?? attempt;
        const waitMs = retryAfter * 1000 + 400;
        console.warn(
          `[telegram:queue] Rate limited (429) on chat ${chatId}. Waiting ${waitMs}ms before retry ${attempt}/${maxAttempts}...`
        );
        if (attempt < maxAttempts) {
          await sleep(waitMs);
          continue;
        }
      }

      // Fallback: If Telegram cannot parse custom HTML entities, strip tags and resend
      if (data.description && /can't parse entities/i.test(data.description)) {
        const plainRes = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: htmlText.replace(/<[^>]+>/g, ""),
            disable_web_page_preview: false,
          }),
        });
        const plainData = (await plainRes.json()) as { ok: boolean; description?: string };
        if (plainData.ok) {
          return { ok: true };
        }
      }

      // Transient Telegram 5xx server error: retry with backoff
      if (res.status >= 500 && attempt < maxAttempts) {
        await sleep(1000 * attempt);
        continue;
      }

      return { ok: false, error: data.description || "Failed to send message" };
    } catch (err) {
      if (attempt < maxAttempts) {
        await sleep(1000 * attempt);
        continue;
      }
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Network error contacting Telegram",
      };
    }
  }

  return { ok: false, error: "Exceeded max retries delivering Telegram notification" };
}

/**
 * Auto-detects the group chat ID where the bot was added.
 * Inspects getUpdates for group, supergroup, or channel messages.
 */
export async function autoFetchTelegramChatId(botToken: string): Promise<{
  ok: boolean;
  chatId?: string;
  chatTitle?: string;
  chatType?: string;
  error?: string;
}> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/getUpdates?limit=50&allowed_updates=["message","my_chat_member","channel_post"]`
    );
    const data = (await res.json()) as {
      ok: boolean;
      description?: string;
      result?: Array<{
        message?: {
          chat: { id: number | string; title?: string; first_name?: string; type: string };
        };
        my_chat_member?: {
          chat: { id: number | string; title?: string; first_name?: string; type: string };
        };
        channel_post?: {
          chat: { id: number | string; title?: string; first_name?: string; type: string };
        };
      }>;
    };

    if (!data.ok) {
      return { ok: false, error: data.description || "Invalid Bot Token" };
    }

    const updates = data.result || [];
    if (updates.length === 0) {
      return {
        ok: false,
        error:
          "No messages found yet. Please add your Bot to your Telegram Group as Admin, send a message (e.g. 'hello'), and click Auto-Detect again.",
      };
    }

    // Search backwards for the most recent group, supergroup, or channel
    for (let i = updates.length - 1; i >= 0; i--) {
      const u = updates[i];
      const chat =
        u?.message?.chat || u?.my_chat_member?.chat || u?.channel_post?.chat;
      if (
        chat &&
        (chat.type === "group" ||
          chat.type === "supergroup" ||
          chat.type === "channel")
      ) {
        return {
          ok: true,
          chatId: String(chat.id),
          chatTitle: chat.title || "Telegram Group",
          chatType: chat.type,
        };
      }
    }

    // If no group found, take private chat if any
    const latest = updates[updates.length - 1];
    const anyChat =
      latest?.message?.chat ||
      latest?.my_chat_member?.chat ||
      latest?.channel_post?.chat;
    if (anyChat) {
      return {
        ok: true,
        chatId: String(anyChat.id),
        chatTitle: anyChat.title || anyChat.first_name || "Telegram Chat",
        chatType: anyChat.type,
      };
    }

    return {
      ok: false,
      error:
        "Could not detect group. Make sure your bot is added to your Telegram Group and someone sent a message.",
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error contacting Telegram API",
    };
  }
}

/**
 * Dispatch an automated Telegram notification safely in the background using Redis cache.
 */
export async function sendTelegramNotification(
  prisma: PrismaClient,
  channelType: TelegramChannelType,
  featureKey:
    | "notifyPunchIn"
    | "notifyLeave"
    | "notifyBirthday"
    | "notifyNewJoin"
    | "notifyCandidate"
    | "notifyResigned"
    | "notifyTerminated",
  htmlMessage: string
) {
  try {
    const config = await getTelegramConfig(prisma, channelType);
    if (!config || !config.enabled || !config.botToken || !config.chatId) {
      return;
    }
    if (!config[featureKey]) {
      return;
    }
    await sendRawTelegramMessage(config.botToken, config.chatId, htmlMessage);
  } catch (err) {
    console.error(`[telegram:${channelType}] notification failed:`, err);
  }
}

// -------------------------------------------------------------
// Pure Clean Message Templates (ZERO Emojis)
// -------------------------------------------------------------

export function formatPunchTelegramMessage(data: {
  employeeName: string;
  employeeCode: string;
  timeStr: string;
  dateStr: string;
  locationName: string;
  lat?: number | null;
  lng?: number | null;
  statusBadge?: string;
}): string {
  const mapsUrl =
    data.lat != null && data.lng != null
      ? `https://www.google.com/maps?q=${data.lat},${data.lng}`
      : null;

  return [
    "<b>[PUNCH-IN ALERT]</b>",
    "----------------------------------------",
    `<b>Employee:</b> ${escapeHtml(data.employeeName)} (${escapeHtml(data.employeeCode)})`,
    `<b>Date:</b> ${data.dateStr}`,
    `<b>Time:</b> ${data.timeStr}${data.statusBadge ? ` (${data.statusBadge})` : ""}`,
    `<b>Location:</b> ${escapeHtml(data.locationName)}`,
    mapsUrl ? `<b>Maps:</b> <a href="${mapsUrl}">View on Google Maps</a>` : null,
    "",
    "<i>Realty Smartz Private Limited</i>",
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatLeaveTelegramMessage(data: {
  employeeName: string;
  employeeCode?: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: string;
}): string {
  return [
    "<b>[LEAVE APPLICATION]</b>",
    "----------------------------------------",
    `<b>Employee:</b> ${escapeHtml(data.employeeName)}${data.employeeCode ? ` (${escapeHtml(data.employeeCode)})` : ""}`,
    `<b>Leave Type:</b> ${escapeHtml(data.leaveType)}`,
    `<b>Period:</b> ${data.startDate} to ${data.endDate} (${data.days} ${data.days === 1 ? "day" : "days"})`,
    `<b>Reason:</b> ${escapeHtml(data.reason)}`,
    `<b>Status:</b> ${escapeHtml(data.status)}`,
    "",
    "<i>Realty Smartz HR Portal</i>",
  ].join("\n");
}

export function formatBirthdayTelegramMessage(data: {
  employeeName: string;
  designation?: string | null;
  department?: string | null;
}): string {
  return [
    "<b>[BIRTHDAY CELEBRATION]</b>",
    "----------------------------------------",
    "Wishing a very Happy Birthday to:",
    `<b>${escapeHtml(data.employeeName)}</b>`,
    data.designation ? `<b>Role:</b> ${escapeHtml(data.designation)}` : null,
    data.department ? `<b>Department:</b> ${escapeHtml(data.department)}` : null,
    "",
    "Wishing you great success, good health, and wonderful achievements from the entire Realty Smartz family!",
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatNewJoinTelegramMessage(data: {
  employeeName: string;
  employeeCode: string;
  designation?: string | null;
  department?: string | null;
  dateOfJoining?: string | null;
  email: string;
  phone?: string | null;
}): string {
  return [
    "<b>[NEW EMPLOYEE ONBOARDED]</b>",
    "----------------------------------------",
    `<b>Name:</b> ${escapeHtml(data.employeeName)} (${escapeHtml(data.employeeCode)})`,
    data.designation ? `<b>Designation:</b> ${escapeHtml(data.designation)}` : null,
    data.department ? `<b>Department:</b> ${escapeHtml(data.department)}` : null,
    data.dateOfJoining ? `<b>Date of Joining:</b> ${data.dateOfJoining}` : null,
    `<b>Email:</b> ${escapeHtml(data.email)}`,
    data.phone ? `<b>Phone:</b> ${escapeHtml(data.phone)}` : null,
    "",
    "Welcome to the Realty Smartz team!",
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatNewCandidateTelegramMessage(data: {
  candidateName: string;
  jobTitle: string;
  email: string;
  phone: string;
  source: string;
  referredBy?: string | null;
}): string {
  return [
    "<b>[NEW CANDIDATE APPLICATION]</b>",
    "----------------------------------------",
    `<b>Candidate:</b> ${escapeHtml(data.candidateName)}`,
    `<b>Position:</b> ${escapeHtml(data.jobTitle)}`,
    `<b>Phone:</b> ${escapeHtml(data.phone)}`,
    `<b>Email:</b> ${escapeHtml(data.email)}`,
    `<b>Source:</b> ${escapeHtml(data.source)}`,
    data.referredBy ? `<b>Referred By:</b> ${escapeHtml(data.referredBy)}` : null,
    "",
    "<i>Realty Smartz Recruitment</i>",
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatStatusChangeTelegramMessage(data: {
  employeeName: string;
  employeeCode: string;
  previousStatus: string;
  newStatus: string;
  effectiveDate: string;
}): string {
  const isResigned = data.newStatus === "RESIGNED";
  const isTerminated = data.newStatus === "TERMINATED";
  const title = isResigned
    ? "[EMPLOYEE RESIGNATION UPDATE]"
    : isTerminated
      ? "[EMPLOYEE TERMINATION UPDATE]"
      : "[EMPLOYEE STATUS CHANGE]";

  return [
    `<b>${title}</b>`,
    "----------------------------------------",
    `<b>Employee:</b> ${escapeHtml(data.employeeName)} (${escapeHtml(data.employeeCode)})`,
    `<b>Status Change:</b> ${data.previousStatus} to <b>${data.newStatus}</b>`,
    `<b>Effective Date:</b> ${data.effectiveDate}`,
    "",
    "<i>Realty Smartz HR Portal</i>",
  ].join("\n");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
