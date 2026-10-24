"use client";

import { useState, useEffect } from "react";
import {
  Bot,
  Send,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  Users,
  Sparkles,
  Info,
  Eye,
  EyeOff,
  Cake,
  ShieldCheck,
  Check,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { userFacingErrorMessage } from "@/lib/user-facing-error";

type ChannelType = "ATTENDANCE_LEAVE" | "HR_LIFECYCLE";

export default function AutomationsPage() {
  const utils = trpc.useUtils();
  const { data: configs, isLoading } = trpc.telegram.getConfigs.useQuery();

  const [activeTab, setActiveTab] = useState<ChannelType>("ATTENDANCE_LEAVE");

  // Attendance & Leave form state
  const [attToken, setAttToken] = useState("");
  const [attChatId, setAttChatId] = useState("");
  const [attChatTitle, setAttChatTitle] = useState("");
  const [attEnabled, setAttEnabled] = useState(false);
  const [showAttToken, setShowAttToken] = useState(false);
  const [attFlags, setAttFlags] = useState({
    notifyPunchIn: true,
    notifyLeave: true,
    notifyBirthday: true,
  });

  // HR & Lifecycle form state
  const [hrToken, setHrToken] = useState("");
  const [hrChatId, setHrChatId] = useState("");
  const [hrChatTitle, setHrChatTitle] = useState("");
  const [hrEnabled, setHrEnabled] = useState(false);
  const [showHrToken, setShowHrToken] = useState(false);
  const [hrFlags, setHrFlags] = useState({
    notifyNewJoin: true,
    notifyCandidate: true,
    notifyResigned: true,
    notifyTerminated: true,
  });

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Sync data from DB
  useEffect(() => {
    if (configs) {
      if (configs.attendanceLeave) {
        setAttToken(configs.attendanceLeave.botToken || "");
        setAttChatId(configs.attendanceLeave.chatId || "");
        setAttChatTitle(configs.attendanceLeave.chatTitle || "");
        setAttEnabled(configs.attendanceLeave.enabled);
        setAttFlags({
          notifyPunchIn: configs.attendanceLeave.notifyPunchIn,
          notifyLeave: configs.attendanceLeave.notifyLeave,
          notifyBirthday: configs.attendanceLeave.notifyBirthday,
        });
      }
      if (configs.hrLifecycle) {
        setHrToken(configs.hrLifecycle.botToken || "");
        setHrChatId(configs.hrLifecycle.chatId || "");
        setHrChatTitle(configs.hrLifecycle.chatTitle || "");
        setHrEnabled(configs.hrLifecycle.enabled);
        setHrFlags({
          notifyNewJoin: configs.hrLifecycle.notifyNewJoin,
          notifyCandidate: configs.hrLifecycle.notifyCandidate,
          notifyResigned: configs.hrLifecycle.notifyResigned,
          notifyTerminated: configs.hrLifecycle.notifyTerminated,
        });
      }
    }
  }, [configs]);

  const updateMutation = trpc.telegram.updateConfig.useMutation({
    onSuccess: () => {
      setFeedback({
        type: "success",
        text: "Automation bot configuration saved successfully!",
      });
      utils.telegram.getConfigs.invalidate();
    },
    onError: (err) => {
      setFeedback({ type: "error", text: userFacingErrorMessage(err) });
    },
  });

  const autoDetectMutation = trpc.telegram.autoDetectChatId.useMutation({
    onSuccess: (data) => {
      if (activeTab === "ATTENDANCE_LEAVE") {
        setAttChatId(data.chatId);
        setAttChatTitle(data.chatTitle);
        setAttEnabled(true);
      } else {
        setHrChatId(data.chatId);
        setHrChatTitle(data.chatTitle);
        setHrEnabled(true);
      }
      setFeedback({
        type: "success",
        text: `Group detected successfully: "${data.chatTitle}" (Chat ID: ${data.chatId})`,
      });
    },
    onError: (err) => {
      setFeedback({ type: "error", text: userFacingErrorMessage(err) });
    },
  });

  const testMessageMutation = trpc.telegram.sendTestMessage.useMutation({
    onSuccess: () => {
      setFeedback({
        type: "success",
        text: "Test message delivered! Bot automation is now SAVED and ACTIVE for this group.",
      });
      if (activeTab === "ATTENDANCE_LEAVE") {
        setAttEnabled(true);
      } else {
        setHrEnabled(true);
      }
      utils.telegram.getConfigs.invalidate();
    },
    onError: (err) => {
      setFeedback({ type: "error", text: userFacingErrorMessage(err) });
    },
  });

  const birthdayMutation = trpc.telegram.triggerBirthdayCheck.useMutation({
    onSuccess: (res) => {
      if (res.count === 0) {
        setFeedback({
          type: "success",
          text: `Weekly birthday check sent (${res.weekRange}): No birthdays this week. Message sent to Telegram.`,
        });
      } else {
        setFeedback({
          type: "success",
          text: `Weekly birthday check sent (${res.weekRange}): Found ${res.count} birthday(s) this week! Announcement delivered to Telegram.`,
        });
      }
    },
    onError: (err) => {
      setFeedback({ type: "error", text: userFacingErrorMessage(err) });
    },
  });

  const handleSaveAttendance = () => {
    const isEnabled = attEnabled || Boolean(attToken.trim() && attChatId.trim());
    setAttEnabled(isEnabled);
    updateMutation.mutate({
      channelType: "ATTENDANCE_LEAVE",
      botToken: attToken.trim() || null,
      chatId: attChatId.trim() || null,
      chatTitle: attChatTitle.trim() || null,
      enabled: isEnabled,
      ...attFlags,
    });
  };

  const handleSaveHR = () => {
    const isEnabled = hrEnabled || Boolean(hrToken.trim() && hrChatId.trim());
    setHrEnabled(isEnabled);
    updateMutation.mutate({
      channelType: "HR_LIFECYCLE",
      botToken: hrToken.trim() || null,
      chatId: hrChatId.trim() || null,
      chatTitle: hrChatTitle.trim() || null,
      enabled: isEnabled,
      ...hrFlags,
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-neutral-500 gap-2">
        <RefreshCw className="h-4 w-4 animate-spin text-[#5D3EBC]" />
        Loading Telegram automation settings...
      </div>
    );
  }

  const attConfigured = Boolean(
    configs?.attendanceLeave?.enabled &&
      configs?.attendanceLeave?.botToken &&
      configs?.attendanceLeave?.chatId
  );
  const hrConfigured = Boolean(
    configs?.hrLifecycle?.enabled &&
      configs?.hrLifecycle?.botToken &&
      configs?.hrLifecycle?.chatId
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">
              Automations
            </h1>
            <Badge className="bg-[#5D3EBC] text-white hover:bg-[#4C329B] font-semibold text-xs px-2.5">
              Multi-Bot
            </Badge>
            {configs?.redisConnected && (
              <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 font-medium">
                Redis Connected
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs sm:text-sm text-neutral-500">
            Automate real-time group notifications for attendance, leaves, employee lifecycle, and birthdays.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => birthdayMutation.mutate()}
          disabled={birthdayMutation.isLoading}
          className="gap-2 text-xs font-semibold self-start sm:self-auto border-neutral-300 hover:bg-neutral-50"
        >
          <Cake className="h-3.5 w-3.5 text-pink-500" />
          {birthdayMutation.isLoading ? "Checking..." : "Trigger Weekly Birthdays Check"}
        </Button>
      </div>

      {/* Guide Banner */}
      <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 via-purple-50/50 to-pink-50/30 p-4 sm:p-5 text-neutral-800">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#5D3EBC] text-white shadow-sm mt-0.5">
            <Bot className="h-5 w-5" />
          </div>
          <div className="space-y-2 text-xs">
            <div className="font-bold text-sm text-neutral-900">
              How to connect your Telegram Bot (3 Quick Steps):
            </div>
            <ol className="list-decimal pl-4 space-y-1 text-neutral-600 font-medium leading-relaxed">
              <li>
                Open Telegram, search for <b>@BotFather</b> and send <code>/newbot</code> to get your <b>Bot Token</b>.
              </li>
              <li>
                Create a Telegram Group, add your new Bot as an <b>Admin</b>, and send any message (e.g. <code>hi</code>) in the group.
              </li>
              <li>
                Paste your <b>Bot Token</b> below and click <b>Auto-Detect Group ID</b>. Your Group Chat ID will be filled automatically!
              </li>
            </ol>
          </div>
        </div>
      </div>

      {/* Feedback Message */}
      {feedback && (
        <div
          className={`rounded-xl border p-4 text-xs font-medium flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
              : "bg-red-50 text-red-900 border-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-neutral-400 hover:text-neutral-600 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-neutral-200 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("ATTENDANCE_LEAVE")}
          className={`flex items-center gap-2 py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors ${
            activeTab === "ATTENDANCE_LEAVE"
              ? "border-[#5D3EBC] text-[#5D3EBC]"
              : "border-transparent text-neutral-500 hover:text-neutral-900"
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Bot 1: Attendance, Leaves & Birthdays</span>
          <span
            className={`h-2 w-2 rounded-full ${
              attConfigured ? "bg-emerald-500" : "bg-neutral-300"
            }`}
          />
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("HR_LIFECYCLE")}
          className={`flex items-center gap-2 py-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition-colors ${
            activeTab === "HR_LIFECYCLE"
              ? "border-[#5D3EBC] text-[#5D3EBC]"
              : "border-transparent text-neutral-500 hover:text-neutral-900"
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Bot 2: HR, Candidates & Status</span>
          <span
            className={`h-2 w-2 rounded-full ${
              hrConfigured ? "bg-emerald-500" : "bg-neutral-300"
            }`}
          />
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: ATTENDANCE & LEAVES BOT */}
      {/* ========================================================= */}
      {activeTab === "ATTENDANCE_LEAVE" && (
        <div className="space-y-6">
          <Card className="border-neutral-200">
            <CardHeader className="pb-4 border-b border-neutral-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#5D3EBC]" />
                  Attendance & Leaves Bot Setup
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Sends live alerts for employee Punch-In, Leave Requests, and Weekly Birthday Announcements (every Monday).
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-neutral-600">
                  {attEnabled ? "Active" : "Disabled"}
                </span>
                <input
                  type="checkbox"
                  checked={attEnabled}
                  onChange={(e) => setAttEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300 text-[#5D3EBC] focus:ring-[#5D3EBC] cursor-pointer"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-5">
              {/* Token Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-700 block">
                  Telegram Bot Token:
                </label>
                <div className="relative">
                  <input
                    type={showAttToken ? "text" : "password"}
                    value={attToken}
                    onChange={(e) => setAttToken(e.target.value)}
                    placeholder="e.g. 789123456:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 pr-10 text-xs font-mono text-neutral-800 focus:outline-none focus:ring-2 focus:ring-[#5D3EBC]/30 focus:border-[#5D3EBC]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAttToken(!showAttToken)}
                    className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-600"
                  >
                    {showAttToken ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-neutral-400">
                  From @BotFather on Telegram.
                </p>
              </div>

              {/* Chat ID & Auto-Detect */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-700">
                    Telegram Group Chat ID:
                  </label>
                  {attChatTitle && (
                    <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                      Group: {attChatTitle}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={attChatId}
                    onChange={(e) => setAttChatId(e.target.value)}
                    placeholder="e.g. -1001234567890"
                    className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-xs font-mono text-neutral-800 focus:outline-none focus:ring-2 focus:ring-[#5D3EBC]/30 focus:border-[#5D3EBC]"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!attToken || autoDetectMutation.isLoading}
                    onClick={() => autoDetectMutation.mutate({ botToken: attToken })}
                    className="shrink-0 text-xs font-semibold gap-1.5 bg-neutral-50 hover:bg-neutral-100"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-[#5D3EBC]" />
                    {autoDetectMutation.isLoading ? "Detecting..." : "Auto-Detect Group ID"}
                  </Button>
                </div>
                <p className="text-[11px] text-neutral-400">
                  Negative number for groups (e.g. -100...). Add the bot to your group and send a message first.
                </p>
              </div>

              {/* Event Checkboxes */}
              <div className="pt-3 border-t border-neutral-100 space-y-3">
                <span className="text-xs font-bold text-neutral-700 block">
                  Select Events to Send to this Group:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <label className="flex items-center gap-2.5 p-3 rounded-lg border border-neutral-200 hover:bg-neutral-50/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={attFlags.notifyPunchIn}
                      onChange={(e) =>
                        setAttFlags({ ...attFlags, notifyPunchIn: e.target.checked })
                      }
                      className="rounded border-neutral-300 text-[#5D3EBC] focus:ring-[#5D3EBC]"
                    />
                    <div>
                      <div className="font-semibold text-neutral-800">Punch-In Alert</div>
                      <div className="text-[11px] text-neutral-400">Employee name, time, location & Maps link</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-3 rounded-lg border border-neutral-200 hover:bg-neutral-50/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={attFlags.notifyLeave}
                      onChange={(e) =>
                        setAttFlags({ ...attFlags, notifyLeave: e.target.checked })
                      }
                      className="rounded border-neutral-300 text-[#5D3EBC] focus:ring-[#5D3EBC]"
                    />
                    <div>
                      <div className="font-semibold text-neutral-800">Leave Applications</div>
                      <div className="text-[11px] text-neutral-400">Leave type, start & end date, reason</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-3 rounded-lg border border-neutral-200 hover:bg-neutral-50/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={attFlags.notifyBirthday}
                      onChange={(e) =>
                        setAttFlags({ ...attFlags, notifyBirthday: e.target.checked })
                      }
                      className="rounded border-neutral-300 text-[#5D3EBC] focus:ring-[#5D3EBC]"
                    />
                    <div>
                      <div className="font-semibold text-neutral-800">Weekly Birthday Announcement</div>
                      <div className="text-[11px] text-neutral-400">Weekly Monday post with upcoming birthdays & contacts</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={
                    !attToken || !attChatId || testMessageMutation.isLoading
                  }
                  onClick={() =>
                    testMessageMutation.mutate({
                      channelType: "ATTENDANCE_LEAVE",
                      botToken: attToken,
                      chatId: attChatId,
                    })
                  }
                  className="gap-2 text-xs font-semibold"
                >
                  <Send className="h-3.5 w-3.5 text-neutral-600" />
                  {testMessageMutation.isLoading ? "Sending..." : "Send Test Message"}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  disabled={updateMutation.isLoading}
                  onClick={handleSaveAttendance}
                  className="bg-[#5D3EBC] hover:bg-[#4C329B] text-white text-xs font-bold px-5"
                >
                  {updateMutation.isLoading ? "Saving..." : "Save Attendance Bot Settings"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: HR & EMPLOYEE LIFECYCLE BOT */}
      {/* ========================================================= */}
      {activeTab === "HR_LIFECYCLE" && (
        <div className="space-y-6">
          <Card className="border-neutral-200">
            <CardHeader className="pb-4 border-b border-neutral-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#5D3EBC]" />
                  HR & Lifecycle Bot Setup
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Sends live alerts for newly joined employees, candidate applications, resignations, and terminations.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-neutral-600">
                  {hrEnabled ? "Active" : "Disabled"}
                </span>
                <input
                  type="checkbox"
                  checked={hrEnabled}
                  onChange={(e) => setHrEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300 text-[#5D3EBC] focus:ring-[#5D3EBC] cursor-pointer"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-5">
              {/* Token Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-700 block">
                  Telegram Bot Token (for HR Channel):
                </label>
                <div className="relative">
                  <input
                    type={showHrToken ? "text" : "password"}
                    value={hrToken}
                    onChange={(e) => setHrToken(e.target.value)}
                    placeholder="e.g. 789123456:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 pr-10 text-xs font-mono text-neutral-800 focus:outline-none focus:ring-2 focus:ring-[#5D3EBC]/30 focus:border-[#5D3EBC]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowHrToken(!showHrToken)}
                    className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-600"
                  >
                    {showHrToken ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="text-[11px] text-neutral-400">
                  You can use a separate bot token or the same one as Bot 1.
                </p>
              </div>

              {/* Chat ID & Auto-Detect */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-700">
                    HR Group Chat ID:
                  </label>
                  {hrChatTitle && (
                    <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                      Group: {hrChatTitle}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={hrChatId}
                    onChange={(e) => setHrChatId(e.target.value)}
                    placeholder="e.g. -1009876543210"
                    className="flex-1 rounded-lg border border-neutral-200 px-3 py-2 text-xs font-mono text-neutral-800 focus:outline-none focus:ring-2 focus:ring-[#5D3EBC]/30 focus:border-[#5D3EBC]"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!hrToken || autoDetectMutation.isLoading}
                    onClick={() => autoDetectMutation.mutate({ botToken: hrToken })}
                    className="shrink-0 text-xs font-semibold gap-1.5 bg-neutral-50 hover:bg-neutral-100"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-[#5D3EBC]" />
                    {autoDetectMutation.isLoading ? "Detecting..." : "Auto-Detect Group ID"}
                  </Button>
                </div>
                <p className="text-[11px] text-neutral-400">
                  Target group for internal HR alerts.
                </p>
              </div>

              {/* Event Checkboxes */}
              <div className="pt-3 border-t border-neutral-100 space-y-3">
                <span className="text-xs font-bold text-neutral-700 block">
                  Select Events to Send to HR Group:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <label className="flex items-center gap-2.5 p-3 rounded-lg border border-neutral-200 hover:bg-neutral-50/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hrFlags.notifyNewJoin}
                      onChange={(e) =>
                        setHrFlags({ ...hrFlags, notifyNewJoin: e.target.checked })
                      }
                      className="rounded border-neutral-300 text-[#5D3EBC] focus:ring-[#5D3EBC]"
                    />
                    <div>
                      <div className="font-semibold text-neutral-800">New Employee Onboarded</div>
                      <div className="text-[11px] text-neutral-400">Name, Code, Designation, Department & DOJ</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-3 rounded-lg border border-neutral-200 hover:bg-neutral-50/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hrFlags.notifyCandidate}
                      onChange={(e) =>
                        setHrFlags({ ...hrFlags, notifyCandidate: e.target.checked })
                      }
                      className="rounded border-neutral-300 text-[#5D3EBC] focus:ring-[#5D3EBC]"
                    />
                    <div>
                      <div className="font-semibold text-neutral-800">Candidate Applied / Referred</div>
                      <div className="text-[11px] text-neutral-400">Position, Candidate Name, Contact & Source</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-3 rounded-lg border border-neutral-200 hover:bg-neutral-50/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hrFlags.notifyResigned}
                      onChange={(e) =>
                        setHrFlags({ ...hrFlags, notifyResigned: e.target.checked })
                      }
                      className="rounded border-neutral-300 text-[#5D3EBC] focus:ring-[#5D3EBC]"
                    />
                    <div>
                      <div className="font-semibold text-neutral-800">Employee Resigned</div>
                      <div className="text-[11px] text-neutral-400">Employee resignation status & effective date</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-3 rounded-lg border border-neutral-200 hover:bg-neutral-50/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hrFlags.notifyTerminated}
                      onChange={(e) =>
                        setHrFlags({ ...hrFlags, notifyTerminated: e.target.checked })
                      }
                      className="rounded border-neutral-300 text-[#5D3EBC] focus:ring-[#5D3EBC]"
                    />
                    <div>
                      <div className="font-semibold text-neutral-800">Employee Terminated</div>
                      <div className="text-[11px] text-neutral-400">Termination record & effective date</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!hrToken || !hrChatId || testMessageMutation.isLoading}
                  onClick={() =>
                    testMessageMutation.mutate({
                      channelType: "HR_LIFECYCLE",
                      botToken: hrToken,
                      chatId: hrChatId,
                    })
                  }
                  className="gap-2 text-xs font-semibold"
                >
                  <Send className="h-3.5 w-3.5 text-neutral-600" />
                  {testMessageMutation.isLoading ? "Sending..." : "Send Test Message"}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  disabled={updateMutation.isLoading}
                  onClick={handleSaveHR}
                  className="bg-[#5D3EBC] hover:bg-[#4C329B] text-white text-xs font-bold px-5"
                >
                  {updateMutation.isLoading ? "Saving..." : "Save HR Bot Settings"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
