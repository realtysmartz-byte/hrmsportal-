"use client";

import Link from "next/link";
import { WifiOff, RotateCcw, Home } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-bg px-4 text-center">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 shadow-lg">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>

        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 text-brand-teal">
          <WifiOff className="h-8 w-8 text-teal-700" />
        </div>

        <h1 className="font-display text-2xl font-bold text-neutral-900">
          You&apos;re Offline
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          Some features need an internet connection. Don&apos;t worry — cached pages and local data will sync automatically once you&apos;re back online.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            onClick={() => window.location.reload()}
            className="gap-2 bg-brand-teal text-white hover:bg-teal-700"
          >
            <RotateCcw className="h-4 w-4" />
            Try Again
          </Button>

          <Link href="/employee-portal/dashboard">
            <Button variant="outline" className="w-full gap-2 border-neutral-300">
              <Home className="h-4 w-4" />
              Go to Home
            </Button>
          </Link>
        </div>

        <p className="mt-6 text-xs text-neutral-400">
          Realty Smartz Private Limited HRMS · Progressive Web App
        </p>
      </div>
    </div>
  );
}
