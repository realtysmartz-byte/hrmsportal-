"use client";

import { useState, useRef, useEffect } from "react";
import {
  HelpCircle,
  X,
  Send,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Clock,
  Calendar,
  Target,
  Sparkles,
  Loader2,
  RefreshCw,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface IssueOption {
  id: string;
  icon: typeof MapPin;
  label: string;
  shortDesc: string;
  tip: string;
}

const COMMON_ISSUES: IssueOption[] = [
  {
    id: "location_gps",
    icon: MapPin,
    label: "Location & GPS Services",
    shortDesc: "Issues with location detection or GPS permissions",
    tip: "Please ensure device location services are enabled and permissions are set to 'Allow all the time' in device settings.",
  },
  {
    id: "punch_attendance",
    icon: Clock,
    label: "Attendance & Punch Records",
    shortDesc: "Issues recording punch-in, punch-out, or status",
    tip: "Verify your internet connectivity and ensure you are within the designated work perimeter.",
  },
  {
    id: "leave_balance",
    icon: Calendar,
    label: "Leave & Balance Inquiries",
    shortDesc: "Questions regarding leave balance or request approvals",
    tip: "Leave balances update automatically once the corresponding application is processed.",
  },
  {
    id: "target_milestone",
    icon: Target,
    label: "Performance & Target Milestones",
    shortDesc: "Target sheets or performance metrics not displaying",
    tip: "Target sheets are updated at the start of each performance cycle. Submit a query if your sheet is missing.",
  },
  {
    id: "other_issue",
    icon: HelpCircle,
    label: "General Technical Assistance",
    shortDesc: "Report an application error or submit operational feedback",
    tip: "Please describe the behavior or error you encountered so our technical team can review it.",
  },
];

export function SupportChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<IssueOption | null>(null);
  const [customDetails, setCustomDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Bulletproof background scroll prevention across mobile, WebView, and desktop
  useEffect(() => {
    if (!isOpen) return;

    const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
    const originalBodyPosition = document.body.style.position;
    const originalBodyTop = document.body.style.top;
    const originalBodyWidth = document.body.style.width;
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;

    // Freeze body position at exact current scroll position
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    // Prevent default touchmove on window/document while modal is open
    // except for inside our dialog's scrollable content container
    const preventTouchScroll = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (scrollRef.current && scrollRef.current.contains(target)) {
        return; // Allow scrolling inside the chatbot conversation box
      }
      if (e.cancelable) {
        e.preventDefault();
      }
    };

    window.addEventListener("touchmove", preventTouchScroll, { passive: false });

    return () => {
      document.body.style.position = originalBodyPosition;
      document.body.style.top = originalBodyTop;
      document.body.style.width = originalBodyWidth;
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      window.removeEventListener("touchmove", preventTouchScroll);
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  // Auto-scroll chat area to latest message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [selectedIssue, isSuccess, errorMsg]);

  const handleSelectIssue = (issue: IssueOption) => {
    setSelectedIssue(issue);
    setErrorMsg(null);
  };

  const handleReset = () => {
    setSelectedIssue(null);
    setCustomDetails("");
    setIsSuccess(false);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssue || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    let deviceInfo = "Web Browser";
    if (typeof window !== "undefined") {
      const isAndroid = /Android/i.test(navigator.userAgent);
      const isCapacitor = Boolean((window as any)?.Capacitor);
      deviceInfo = `${isCapacitor ? "Android App" : isAndroid ? "Mobile Web" : "Desktop Web"} · ${navigator.userAgent.slice(0, 80)}`;
    }

    try {
      const res = await fetch("/api/native/support-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueCategory: selectedIssue.label,
          issueDetails: customDetails.trim() || undefined,
          deviceInfo,
        }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.ok) {
        setIsSuccess(true);
        setErrorMsg(null);
      } else {
        setErrorMsg(
          data?.message || data?.error || "Unable to submit your request. Please try again."
        );
      }
    } catch {
      setErrorMsg("Network error. Please check your connectivity and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* 
        Help Trigger Button: Attached directly ABOVE the 'Me' tab.
        Bottom nav is: max-w-[430px] mx-auto grid grid-cols-4 with 'Me' in col 4.
        Matching exactly places Help centered directly above the 'Me' icon.
      */}
      <div className="fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] left-0 right-0 max-w-[430px] mx-auto pointer-events-none z-30 grid grid-cols-4 px-1">
        <div className="col-start-4 flex justify-center">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Open Help Assistant"
            style={{
              backgroundColor: isOpen ? "var(--active)" : "var(--card)",
              color: isOpen ? "var(--accent)" : "var(--ink)",
              borderColor: isOpen ? "var(--accent)" : "var(--line)",
            }}
            className={cn(
              "pointer-events-auto flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold shadow-md transition-all hover:scale-105 active:scale-95",
              isOpen && "ring-1 ring-[var(--accent)]"
            )}
          >
            <HelpCircle className="h-3.5 w-3.5 text-[var(--accent)] shrink-0" />
            <span>Help</span>
          </button>
        </div>
      </div>

      {/* 
        Background Backdrop: Blocks clicks and touch scrolling behind the dialog
      */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] touch-none overscroll-none transition-opacity"
          onClick={() => setIsOpen(false)}
          onTouchMove={(e) => {
            if (e.cancelable) e.preventDefault();
          }}
          aria-hidden="true"
        />
      )}

      {/* 
        Chatbot Dialog: Clean, responsive, compact window anchored above navigation
      */}
      {isOpen && (
          <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] left-0 right-0 max-w-[430px] mx-auto pointer-events-none z-50 px-2.5 flex justify-end">
            <div
              ref={dialogRef}
              role="dialog"
              aria-labelledby="support-dialog-title"
              style={{
                maxHeight: "min(490px, 72vh)",
                backgroundColor: "var(--card)",
                borderColor: "var(--line)",
                color: "var(--ink)",
              }}
              className="pointer-events-auto w-full max-w-[360px] rounded-[10px] border shadow-2xl overflow-hidden overscroll-contain animate-in fade-in slide-in-from-bottom-2 duration-150 flex flex-col"
            >
                  {/* Header */}
                  <div
                    style={{ backgroundColor: "var(--soft)", borderColor: "var(--line)" }}
                    className="flex items-center justify-between border-b px-3.5 py-2.5 select-none"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        style={{ backgroundColor: "var(--active)", borderColor: "var(--line)", color: "var(--accent)" }}
                        className="flex h-6 w-6 items-center justify-center rounded-full border"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <h3 id="support-dialog-title" className="text-xs font-bold leading-tight" style={{ color: "var(--ink)" }}>
                          Help Assistant
                        </h3>
                        <p className="text-[10px] flex items-center gap-1" style={{ color: "var(--muted)" }}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--ok)" }} /> Operational Support
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="rounded p-1 transition-colors hover:opacity-80"
                      style={{ color: "var(--muted)" }}
                      aria-label="Close Assistant"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                        {/* Scrollable Conversation Content */}
                        <div
                          ref={scrollRef}
                          className="flex flex-col gap-3 p-3 overflow-y-auto overscroll-contain"
                          style={{
                            maxHeight: "calc(min(490px, 72vh) - 50px)",
                            touchAction: "pan-y",
                            WebkitOverflowScrolling: "touch",
                          }}
                        >
                          {/* Greeting */}
                          <div className="flex gap-2 items-start">
                            <div
                              style={{ backgroundColor: "var(--active)", color: "var(--accent)" }}
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                            >
                              RS
                            </div>
                <div
                              style={{ backgroundColor: "var(--soft)", borderColor: "var(--line)", color: "var(--ink)" }}
                              className="rounded-[8px] rounded-tl-none p-2.5 text-xs border leading-relaxed"
                            >
                            Hello! How can we assist you today? Please choose an issue below or submit your details.
                          </div>
                        </div>

                                {/* Success State */}
                                {isSuccess ? (
                                  <div className="flex flex-col gap-2 rounded-[6px] border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-200">
                                    <div className="flex items-center gap-2 font-bold text-sm">
                                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                      Request Submitted Successfully
                                    </div>
                                    <p className="text-[11px] leading-relaxed">
                                      Your issue report has been logged and forwarded directly to the operations team with your profile details. A representative will review this shortly.
                                    </p>
                                    <button
                                      type="button"
                                      onClick={handleReset}
                                      style={{ backgroundColor: "var(--card)", borderColor: "var(--line)", color: "var(--ink)" }}
                                      className="mt-1 flex items-center justify-center gap-1.5 rounded-[4px] border py-1.5 px-3 text-xs font-semibold hover:opacity-90 transition-opacity"
                                    >
                                      <RefreshCw className="h-3 w-3" /> Submit Another Request
                                    </button>
                                  </div>
                                ) : !selectedIssue ? (
                                  /* Issue Options List */
                                  <div className="flex flex-col gap-1.5 pt-1">
                                    <p className="text-[11px] font-semibold px-1" style={{ color: "var(--muted)" }}>
                                      Select a category:
                                    </p>
                                    {COMMON_ISSUES.map((issue) => {
                                      const Icon = issue.icon;
                                      return (
                                        <button
                                          key={issue.id}
                                          type="button"
                                          onClick={() => handleSelectIssue(issue)}
                                          style={{ backgroundColor: "var(--card)", borderColor: "var(--line)" }}
                                          className="group flex items-start gap-2.5 rounded-[6px] border p-2 text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
                                        >
                                          <div
                                            style={{ backgroundColor: "var(--soft)", color: "var(--accent)" }}
                                            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] transition-colors"
                                          >
                                            <Icon className="h-3.5 w-3.5" />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold leading-snug" style={{ color: "var(--ink)" }}>
                                              {issue.label}
                                            </p>
                                            <p className="text-[10px] leading-tight truncate" style={{ color: "var(--muted)" }}>
                                              {issue.shortDesc}
                                            </p>
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  /* Issue Detail & Form */
                                  <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 pt-1">
                                    <div className="flex justify-end">
                                      <div
                                        style={{ backgroundColor: "var(--accent)", color: "var(--accent-ink)" }}
                                        className="rounded-[8px] rounded-tr-none px-3 py-1.5 text-xs font-semibold"
                                      >
                                          {selectedIssue.label}
                                        </div>
                                      </div>

                                        {/* Instant Troubleshooting Hint */}
                                        <div className="flex gap-2 items-start">
                                          <div
                                            style={{ backgroundColor: "var(--active)", color: "var(--accent)" }}
                                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                                          >
                                            RS
                                          </div>
                                          <div
                                            style={{ backgroundColor: "var(--soft)", borderColor: "var(--line)", color: "var(--ink)" }}
                                            className="rounded-[8px] rounded-tl-none p-2.5 text-[11px] border leading-relaxed"
                                          >
                                            <span className="font-semibold" style={{ color: "var(--accent)" }}>Guidance: </span>
                                            {selectedIssue.tip}
                                          </div>
                                        </div>

                                          {/* Description Input */}
                                          <div className="flex flex-col gap-1 mt-1">
                                            <label htmlFor="support-notes" className="text-[11px] font-semibold" style={{ color: "var(--muted)" }}>
                                              Additional Details (Optional):
                                            </label>
                                            <textarea
                                              id="support-notes"
                                              value={customDetails}
                                              onChange={(e) => setCustomDetails(e.target.value)}
                                              placeholder="Provide any additional context or describe what occurred..."
                                              rows={2}
                                              maxLength={500}
                                              style={{ backgroundColor: "var(--field)", borderColor: "var(--line)", color: "var(--ink)" }}
                                              className="w-full rounded-[4px] border p-2 text-xs placeholder:text-[var(--muted)] focus:outline-none resize-none"
                                            />
                                          </div>

                                        {/* Error Banner */}
                                        {errorMsg && (
                                          <div className="flex items-center gap-1.5 rounded-[4px] border border-rose-500/30 bg-rose-500/10 p-2 text-[11px] text-rose-700 dark:text-rose-300">
                                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                            <span>{errorMsg}</span>
                                          </div>
                                        )}

                                            {/* Actions */}
                                            <div className="flex items-center gap-2 pt-1">
                                              <button
                                                type="button"
                                                onClick={handleReset}
                                                disabled={isSubmitting}
                                                style={{ backgroundColor: "var(--card)", borderColor: "var(--line)", color: "var(--muted)" }}
                                                className="flex-1 flex items-center justify-center gap-1 rounded-[4px] border py-2 px-2 text-xs font-semibold hover:opacity-80 transition-opacity disabled:opacity-50"
                                              >
                                                <ChevronLeft className="h-3 w-3" /> Back
                                              </button>
                                              <button
                                                type="submit"
                                                disabled={isSubmitting}
                                                style={{ backgroundColor: "var(--accent)", color: "var(--accent-ink)" }}
                                                className="flex-[2] flex items-center justify-center gap-1.5 rounded-[4px] py-2 px-3 text-xs font-bold hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-50 shadow-sm"
                                              >
                                                {isSubmitting ? (
                                                  <>
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                    <span>Submitting...</span>
                                                  </>
                                                ) : (
                                                  <>
                                                    <Send className="h-3.5 w-3.5" />
                                                    <span>Submit Request</span>
                                                  </>
                                                )}
                                              </button>
                                            </div>
                                      </form>
              )}
                                    </div>
                                  </div>
        </div>
      )}
                      </>
                      );
}
