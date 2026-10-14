"use client";

import Link from "next/link";
import { Cake, Sparkles, Calendar, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { initials } from "@/lib/utils";

interface UpcomingBirthdaysWidgetProps {
  portal?: "employee" | "admin";
  className?: string;
}

export function UpcomingBirthdaysWidget({
  portal = "employee",
  className = "",
}: UpcomingBirthdaysWidgetProps) {
  const { data: birthdays, isLoading } = trpc.employee.getUpcomingBirthdays.useQuery(undefined, {
    staleTime: 1000 * 60 * 15, // 15 min cache
  });

  const profileBasePath =
    portal === "admin" ? "/admin-portal/employees" : "/employee-portal/directory";

  const topBirthdays = birthdays?.slice(0, 5) ?? [];

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18 }}
      className={`rounded-lg border border-neutral-200/80 bg-white p-5 md:p-6 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#5D3EBC]/20 text-[#5D3EBC] border border-[#5D3EBC]/30">
            <Cake className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-neutral-900 leading-tight flex items-center gap-1.5">
              🎂 Upcoming Birthdays
            </h3>
            <p className="text-[11px] text-neutral-400 font-medium">
              Next 30 days · Team celebrations
            </p>
          </div>
        </div>

        <Link
          href={profileBasePath}
          className="text-[11px] font-semibold text-neutral-500 hover:text-[#5D3EBC] transition-colors flex items-center gap-0.5"
        >
          View all <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {/* List */}
      <div className="mt-4 space-y-2.5">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-12 rounded-xl bg-neutral-100/70 animate-pulse"
              />
            ))}
          </div>
        ) : topBirthdays.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-200 p-4 text-center">
            <p className="text-xs text-neutral-400">
              No birthdays in the next 30 days.
            </p>
          </div>
        ) : (
          topBirthdays.map((item) => (
            <Link
              key={item.id}
              href={`${profileBasePath}/${item.id}`}
              className={`group flex items-center justify-between rounded-xl p-2.5 transition-all ${
                item.isToday
                  ? "bg-gradient-to-r from-[#5D3EBC]/15 via-[#7B5CD6]/15 to-transparent border border-[#5D3EBC]/40 hover:border-[#5D3EBC]"
                  : "border border-neutral-200/70 bg-neutral-50/50 hover:bg-neutral-50 hover:border-neutral-300"
              }`}
            >
              {/* Colleague Avatar & Details */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-tr from-[#2B3A67] to-[#1E294A] text-white text-xs font-bold">
                    {item.profilePhotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.profilePhotoUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      initials(item.firstName, item.lastName)
                    )}
                  </div>
                  {item.isToday && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#5D3EBC] text-white text-[9px] animate-bounce">
                      🎉
                    </span>
                  )}
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-bold text-neutral-900 truncate group-hover:text-[#5D3EBC] transition-colors">
                    {item.name}
                  </p>
                  <p className="text-[10px] text-neutral-500 truncate">
                    {item.designation || item.department || "Colleague"}
                  </p>
                </div>
              </div>

              {/* Date & Today Badge */}
              <div className="text-right shrink-0">
                {item.isToday ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#5D3EBC] px-2 py-0.5 text-[10px] font-bold text-white">
                    <Sparkles className="h-2.5 w-2.5" />
                    Today!
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-neutral-600 flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-neutral-400" />
                    {item.birthdayDate}
                  </span>
                )}
              </div>
            </Link>
          ))
        )}
      </div>
    </motion.div>
  );
}
