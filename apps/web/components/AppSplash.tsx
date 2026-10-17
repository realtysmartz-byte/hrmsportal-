"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const TITLE = "Realty Smartz";

export function AppSplash() {
  // Start hidden — never block first paint with a pending overlay
  const [show, setShow] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true ||
      new URLSearchParams(window.location.search).get("source") === "pwa";

    if (!standalone || sessionStorage.getItem("rs_splash_shown")) return;

    sessionStorage.setItem("rs_splash_shown", "1");
    setShow(true);
    const t = setTimeout(() => setShow(false), 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="splash"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Realty Smartz" className="h-16 w-16 object-contain" />
          <p className="mt-3 text-lg font-semibold text-neutral-900">{TITLE}</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
