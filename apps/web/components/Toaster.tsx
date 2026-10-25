"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, X, Sparkles } from "lucide-react";
import { dismissToast, subscribeToasts, type ToastItem } from "@/lib/toast";
import { cn } from "@/lib/utils";

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => subscribeToasts(setItems), []);

  return (
    <div className="pointer-events-none fixed right-4 top-[max(1rem,env(safe-area-inset-top))] z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
      <AnimatePresence initial={false}>
        {items.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, x: 60, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-xl border bg-white p-3.5 shadow-lg",
              t.type === "success"
                ? "border-l-4 border-l-emerald-500 border-neutral-200"
                : "border-l-4 border-l-rose-500 border-neutral-200"
            )}
          >
            {t.type === "success" ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
            ) : (
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
            )}
            <div className="flex-1 min-w-0">
              {t.title ? (
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-neutral-900">{t.title}</p>
                    {t.badge && (
                      <span className="rounded-full bg-[#5D3EBC]/10 px-2 py-0.5 text-[10px] font-semibold text-[#5D3EBC]">
                        {t.badge}
                      </span>
                    )}
                  </div>
                  {t.quote ? (
                    <div className="mt-1.5 rounded-lg border border-purple-100 bg-[#F3F0FC]/70 p-2 text-xs text-neutral-800">
                      <div className="flex items-start gap-1.5">
                        <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-[#5D3EBC]" />
                        <span className="italic leading-relaxed">"{t.quote}"</span>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-0.5 text-xs text-neutral-600">{t.message}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-neutral-800">{t.message}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="text-neutral-400 hover:text-neutral-700"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
