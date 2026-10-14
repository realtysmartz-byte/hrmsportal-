"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const TITLE = "Realty Smartz";

export function AppSplash() {
  const [state, setState] = useState<"pending" | "show" | "hidden">("pending");

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true ||
      new URLSearchParams(window.location.search).get("source") === "pwa";

    if (!standalone || sessionStorage.getItem("rs_splash_shown")) {
      setState("hidden");
      return;
    }
    sessionStorage.setItem("rs_splash_shown", "1");
    setState("show");
    const t = setTimeout(() => setState("hidden"), 2600);
    return () => clearTimeout(t);
  }, []);

  if (state === "pending") {
    return (
      <div className="fixed inset-0 z-[200] hidden items-center justify-center bg-white [@media(display-mode:standalone)]:flex">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="h-20 w-20 object-contain" />
      </div>
    );
  }

  return (
    <AnimatePresence>
      {state === "show" && (
        <motion.div
          key="splash"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white"
        >
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="flex flex-col items-center"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <motion.img
              src="/logo.png"
              alt="Realty Smartz"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="h-20 w-20 object-contain"
            />

            <div className="mt-5 flex overflow-hidden text-3xl font-semibold text-neutral-900">
              {TITLE.split("").map((ch, i) => (
                <motion.span
                  key={i}
                  initial={{ y: "110%", opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 + i * 0.05, duration: 0.4, ease: "easeOut" }}
                  className="inline-block whitespace-pre"
                >
                  {ch}
                </motion.span>
              ))}
            </div>

            <motion.p
              initial={{ opacity: 0, letterSpacing: "0.1em" }}
              animate={{ opacity: 1, letterSpacing: "0.5em" }}
              transition={{ delay: 1.1, duration: 0.8, ease: "easeOut" }}
              className="mt-2 text-sm font-medium text-[#5D3EBC]"
            >
              HRMS
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
