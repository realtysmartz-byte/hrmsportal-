"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { KeyRound, Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "@/lib/toast";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";

interface AdminChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdminChangePasswordModal({
  isOpen,
  onClose,
}: AdminChangePasswordModalProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const changeMutation = trpc.employee.changeMyPassword.useMutation({
    onSuccess: async () => {
      toast("success", "Password changed successfully! Logging out...");
      onClose();
      await signOut({ callbackUrl: "/login?message=password-changed" });
    },
    onError: (err) => {
      setError(err.message || "Failed to update password");
    },
  });

  useBodyScrollLock(isOpen);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!newPassword || newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    changeMutation.mutate({ newPassword });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100vh-3.5rem)] my-auto rounded border border-[var(--line)] bg-[var(--card)] p-6 text-[var(--ink)] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-[var(--line)] pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[var(--field)] text-[var(--accent)] border border-[var(--line)]">
            <KeyRound className="h-5 w-5" strokeWidth={1.8} />
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--ink)]">Change admin password</h2>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Enter your new password. You will be logged out to sign in again.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="rounded border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-3 text-xs font-medium text-[var(--danger)]">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1.5">
              New password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="h-11 w-full rounded-none border border-[var(--line)] bg-[var(--field)] px-3.5 text-xs sm:text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/18"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--ink)]"
              >
                {showPassword ? <EyeOff className="h-4 w-4" strokeWidth={1.8} /> : <Eye className="h-4 w-4" strokeWidth={1.8} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--ink)] mb-1.5">
              Confirm new password
            </label>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-type new password"
              className="h-11 w-full rounded-none border border-[var(--line)] bg-[var(--field)] px-3.5 text-xs sm:text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/18"
              required
            />
          </div>

          <div className="rounded border border-[var(--line)] bg-[var(--field)] p-3 text-xs text-[var(--muted)] flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-[var(--accent)] shrink-0 mt-0.5" strokeWidth={1.8} />
            <span>
              <strong>Note:</strong> Saving will immediately terminate active sessions. You must log back in with this new password.
            </span>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[var(--line)]">
            <button
              type="button"
              onClick={onClose}
              disabled={changeMutation.isLoading}
              className="h-11 rounded border border-[var(--line)] bg-transparent px-4 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--hover)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={changeMutation.isLoading}
              className="btn-chamfer flex items-center gap-1.5 bg-[var(--accent)] px-5 h-11 text-xs font-semibold text-white hover:brightness-110 transition-all disabled:opacity-50"
            >
              {changeMutation.isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {changeMutation.isLoading ? "Updating..." : "Update password and sign out"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
