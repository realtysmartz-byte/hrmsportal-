"use client";

import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { useState } from "react";
import { getTRPCClient, trpc } from "@/lib/trpc";
import { toast } from "@/lib/toast";
import { Toaster } from "@/components/Toaster";
import { AccountStatusGuard } from "@/components/AccountStatusGuard";

const SILENT = new Set([
  "attendance.locationPing",
  "attendance.reportLocationDisabled",
  "attendance.savePushSubscription",
]);

const MESSAGES: Record<string, string> = {
  "attendance.checkIn": "Clocked in successfully",
  "attendance.checkOut": "Clocked out successfully",
  "companySettings.update": "Company settings saved",
  "department.create": "Department added",
  "department.update": "Department updated",
  "department.delete": "Department deleted",
  "designation.create": "Designation added",
  "designation.update": "Designation updated",
  "designation.delete": "Designation deleted",
  "emailSettings.sendTestEmail": "Test email sent",
  "employee.create": "Employee added",
  "employee.importExcel": "Employees imported from Excel",
  "attendance.importExcel": "Attendance imported from Excel",
  "employee.update": "Employee details saved",
  "employee.delete": "Employee deleted",
  "employee.updateMyPhoto": "Profile photo updated",
  "employee.uploadDocument": "Document uploaded",
  "employee.deleteDocument": "Document deleted",
  "googleSheets.syncDailyReport": "Synced to Google Sheets",
  "googleSheets.testConnection": "Google Sheets connected",
  "leave.adjustBalance": "Leave balance updated",
  "leave.apply": "Leave request submitted",
  "leave.cancel": "Leave request cancelled",
  "leave.createType": "Leave type added",
  "leave.updateType": "Leave type updated",
  "leave.deleteType": "Leave type deleted",
  "performance.activateCycle": "Cycle activated",
  "performance.closeCycle": "Cycle closed",
  "performance.createCycle": "Cycle created",
  "performance.createGoal": "Goal added",
  "performance.updateGoal": "Goal updated",
  "performance.deleteGoal": "Goal deleted",
  "performance.updateKeyResult": "Key result updated",
  "performance.submitSelfReview": "Self review submitted",
  "performance.submitManagerReview": "Manager review submitted",
  "recruitment.addNote": "Note added",
  "recruitment.createCandidate": "Candidate added",
  "recruitment.createJob": "Job opening created",
  "recruitment.updateJob": "Job opening updated",
  "recruitment.referCandidate": "Referral submitted",
  "recruitment.scheduleInterview": "Interview scheduled",
  "recruitment.updateStage": "Candidate stage updated",
};

function mutationPath(key: unknown): string {
  return (Array.isArray(key) ? key.flat(2) : [])
    .filter((k): k is string => typeof k === "string")
    .join(".");
}

function successMessage(path: string, variables: unknown): string {
  if (path === "leave.respond") {
    return (variables as { action?: string })?.action === "REJECT"
      ? "Leave rejected"
      : "Leave approved";
  }
  if (MESSAGES[path]) return MESSAGES[path];
  const name = path.split(".").pop() ?? "";
  if (/^(delete|remove)/i.test(name)) return "Deleted successfully";
  if (/^(create|add)/i.test(name)) return "Added successfully";
  if (/^update/i.test(name)) return "Updated successfully";
  return "Saved successfully";
}

function errorMessage(error: unknown): string {
  const message = (error as { message?: string })?.message ?? "Something went wrong";
  if (message.startsWith("[")) {
    try {
      const issues = JSON.parse(message) as { message?: string }[];
      if (issues[0]?.message) return issues[0].message;
    } catch {
      return message;
    }
  }
  return message;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
        mutationCache: new MutationCache({
          onSuccess: (_data, variables, _context, mutation) => {
            const path = mutationPath(mutation.options.mutationKey);
            if (SILENT.has(path)) return;
            toast("success", successMessage(path, variables));
          },
          onError: (error, _variables, _context, mutation) => {
            const path = mutationPath(mutation.options.mutationKey);
            if (SILENT.has(path)) return;
            toast("error", errorMessage(error));
          },
        }),
      })
  );
  const [trpcClient] = useState(() => getTRPCClient());

  return (
    <SessionProvider refetchOnWindowFocus refetchInterval={60}>
      <AccountStatusGuard />
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          {children}
          <Toaster />
        </QueryClientProvider>
      </trpc.Provider>
    </SessionProvider>
  );
}
