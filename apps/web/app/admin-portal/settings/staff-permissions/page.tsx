"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import {
  ShieldCheck,
  UserPlus,
  KeyRound,
  Check,
  X,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Users,
  Settings,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "@/lib/toast";

const AVAILABLE_MODULES = [
  { id: "dashboard", label: "Dashboard", desc: "View administrative metrics and team snapshot" },
  { id: "employees", label: "Employees Directory", desc: "View employee profiles and records" },
  { id: "attendance", label: "Team Attendance & Location", desc: "Punches, geofencing, and location traces" },
  { id: "leave", label: "Leave Approvals", desc: "Review, approve, and reject employee leave applications" },
  { id: "recruitment", label: "Recruitment", desc: "Job postings, candidates, and interview rounds" },
  { id: "payroll", label: "Payroll Management", desc: "Calculate salaries, payslips, and payout processing" },
  { id: "performance", label: "Performance", desc: "Goals, OKRs, and appraisal reviews" },
  { id: "departments", label: "Departments & Designations", desc: "Org structure and designations" },
  { id: "settings", label: "Company Settings", desc: "Leave policies, sheets, email, and automations" },
];

export default function StaffPermissionsPage() {
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === "ADMIN";

  const { data: staffList, isLoading, refetch } = trpc.employee.listStaffUsers.useQuery();

  // Create User Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"ADMIN" | "HR">("HR");
  const [newPermissions, setNewPermissions] = useState<string[]>([
    "dashboard",
    "attendance",
    "leave",
  ]);
  const [showPassword, setShowPassword] = useState(false);

  // Edit Permissions Modal state
  const [editingStaff, setEditingStaff] = useState<{
    id: string;
    name: string;
    email: string;
    role: "ADMIN" | "HR";
    permissions: string[];
  } | null>(null);
  const [editPerms, setEditPerms] = useState<string[]>([]);
  const [editRole, setEditRole] = useState<"ADMIN" | "HR">("HR");

  // Reset Password Modal state
  const [passwordStaff, setPasswordStaff] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);
  const [resetPass, setResetPass] = useState("");
  const [showResetPass, setShowResetPass] = useState(false);

  const createMutation = trpc.employee.createStaffUser.useMutation({
    onSuccess: () => {
      toast("success", "Staff user created successfully");
      setShowCreateModal(false);
      resetCreateForm();
      void refetch();
    },
    onError: (err) => {
      toast("error", err.message || "Failed to create staff user");
    },
  });

  const updatePermMutation = trpc.employee.updateStaffPermissions.useMutation({
    onSuccess: () => {
      toast("success", "Permissions updated successfully");
      setEditingStaff(null);
      void refetch();
    },
    onError: (err) => {
      toast("error", err.message || "Failed to update permissions");
    },
  });

  const resetPasswordMutation = trpc.employee.resetStaffPassword.useMutation({
    onSuccess: () => {
      toast("success", "Password updated successfully");
      setPasswordStaff(null);
      setResetPass("");
    },
    onError: (err) => {
      toast("error", err.message || "Failed to reset password");
    },
  });

  function resetCreateForm() {
    setNewFirstName("");
    setNewLastName("");
    setNewEmail("");
    setNewPassword("");
    setNewRole("HR");
    setNewPermissions(["dashboard", "attendance", "leave"]);
  }

  function togglePerm(id: string, list: string[], setList: (val: string[]) => void) {
    if (list.includes(id)) {
      setList(list.filter((x) => x !== id));
    } else {
      setList([...list, id]);
    }
  }

  function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!newFirstName || !newLastName || !newEmail || !newPassword) {
      toast("error", "Please fill all required fields");
      return;
    }
    createMutation.mutate({
      firstName: newFirstName,
      lastName: newLastName,
      email: newEmail,
      password: newPassword,
      role: newRole,
      permissions: newRole === "ADMIN" ? ["*"] : newPermissions,
    });
  }

  function handleSaveEditPerms() {
    if (!editingStaff) return;
    updatePermMutation.mutate({
      employeeId: editingStaff.id,
      role: editRole,
      permissions: editRole === "ADMIN" ? ["*"] : editPerms,
    });
  }

  function handleSavePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordStaff || !resetPass || resetPass.length < 6) {
      toast("error", "Password must be at least 6 characters");
      return;
    }
    resetPasswordMutation.mutate({
      employeeId: passwordStaff.id,
      newPassword: resetPass,
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-neutral-900">
              Staff &amp; Permissions Management
            </h1>
            <p className="text-xs text-neutral-500 mt-0.5">
              Create Admin/HR login credentials and configure granular module access permissions.
            </p>
          </div>
        </div>

        {isSuperAdmin && (
          <button
            type="button"
            onClick={() => {
              resetCreateForm();
              setShowCreateModal(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-violet-700 transition-colors shrink-0"
          >
            <UserPlus className="h-4 w-4" />
            <span>Create Staff / HR User</span>
          </button>
        )}
      </div>

      {/* Staff User List */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xs">
        <div className="border-b border-neutral-200 bg-neutral-50/70 px-5 py-3.5 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-600">
            Admin &amp; HR Team Members ({staffList?.length ?? 0})
          </span>
          <span className="text-[11px] text-neutral-500">
            Super Admins have full access. HR roles see only permitted tabs.
          </span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-xs text-neutral-500 flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
            <span>Loading staff users...</span>
          </div>
        ) : !staffList || staffList.length === 0 ? (
          <div className="p-8 text-center text-xs text-neutral-500">
            No admin/HR users found.
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {staffList.map((staff) => {
              const isAdmin = staff.role === "ADMIN";
              const perms = staff.permissions || [];
              const isAll = isAdmin || perms.includes("*");

              return (
                <div
                  key={staff.id}
                  className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-neutral-50/50 transition-colors"
                >
                  <div className="space-y-1.5 min-w-[260px]">
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-sm text-neutral-900">
                        {staff.firstName} {staff.lastName}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold ${
                          isAdmin
                            ? "bg-violet-100 text-violet-800 border border-violet-200"
                            : "bg-blue-100 text-blue-800 border border-blue-200"
                        }`}
                      >
                        {staff.role}
                      </span>
                      <span className="text-[11px] font-mono text-neutral-400">
                        {staff.employeeCode}
                      </span>
                    </div>

                    <div className="text-xs text-neutral-500 font-mono">
                      {staff.email}
                    </div>

                    {/* Permissions tags */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {isAll ? (
                        <span className="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          Full Access (All Modules)
                        </span>
                      ) : perms.length === 0 ? (
                        <span className="rounded-md bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                          No module permissions assigned
                        </span>
                      ) : (
                        perms.map((p) => {
                          const mod = AVAILABLE_MODULES.find((m) => m.id === p);
                          return (
                            <span
                              key={p}
                              className="rounded-md bg-neutral-100 border border-neutral-200 px-2 py-0.5 text-[10px] font-semibold text-neutral-700"
                            >
                              {mod?.label || p}
                            </span>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Actions for Main Admin */}
                  {isSuperAdmin && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingStaff({
                            id: staff.id,
                            name: `${staff.firstName} ${staff.lastName}`,
                            email: staff.email,
                            role: staff.role as "ADMIN" | "HR",
                            permissions: staff.permissions,
                          });
                          setEditPerms(
                            staff.permissions.includes("*")
                              ? AVAILABLE_MODULES.map((m) => m.id)
                              : staff.permissions
                          );
                          setEditRole(staff.role as "ADMIN" | "HR");
                        }}
                        className="flex items-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors shadow-2xs"
                      >
                        <Settings className="h-3.5 w-3.5 text-neutral-500" />
                        <span>Edit Permissions</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPasswordStaff({
                            id: staff.id,
                            name: `${staff.firstName} ${staff.lastName}`,
                            email: staff.email,
                          });
                          setResetPass("");
                        }}
                        className="flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100 transition-colors shadow-2xs"
                      >
                        <KeyRound className="h-3.5 w-3.5 text-violet-600" />
                        <span>Change Password</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: CREATE STAFF / HR USER */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto overscroll-contain"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl border border-neutral-200 animate-in fade-in zoom-in-95 duration-150 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-neutral-900">
                    Create Admin / HR Login
                  </h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Create credentials and assign module permissions for this staff member.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    placeholder="e.g. Priya"
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-xs text-neutral-900 focus:border-violet-600 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    placeholder="e.g. Sharma"
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-xs text-neutral-900 focus:border-violet-600 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Email (Login ID) *
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="staff@realtysmartz.in"
                    className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-xs text-neutral-900 focus:border-violet-600 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1">
                    Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="w-full rounded-xl border border-neutral-300 px-3 py-2 pr-9 text-xs text-neutral-900 focus:border-violet-600 focus:outline-none"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                    >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Role
                </label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 rounded-xl border border-neutral-200 p-2.5 flex-1 cursor-pointer hover:bg-neutral-50">
                    <input
                      type="radio"
                      name="role"
                      value="HR"
                      checked={newRole === "HR"}
                      onChange={() => setNewRole("HR")}
                      className="text-violet-600"
                    />
                    <div>
                      <div className="font-bold text-neutral-900">HR / Executive HR</div>
                      <div className="text-[10px] text-neutral-500">Access limited to permitted modules only</div>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 rounded-xl border border-neutral-200 p-2.5 flex-1 cursor-pointer hover:bg-neutral-50">
                    <input
                      type="radio"
                      name="role"
                      value="ADMIN"
                      checked={newRole === "ADMIN"}
                      onChange={() => setNewRole("ADMIN")}
                      className="text-violet-600"
                    />
                    <div>
                      <div className="font-bold text-neutral-900">Super Admin</div>
                      <div className="text-[10px] text-neutral-500">Full unlimited access to all modules</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Module Permissions Checkboxes (If Role == HR) */}
              {newRole === "HR" && (
                <div className="space-y-2 pt-2 border-t border-neutral-100">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-neutral-800">
                      Module Permissions (Which tabs they can see):
                    </label>
                    <div className="flex gap-2 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setNewPermissions(["dashboard", "attendance", "leave"])}
                        className="text-violet-600 hover:underline font-semibold"
                      >
                        Executive Preset
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewPermissions(AVAILABLE_MODULES.map((m) => m.id))}
                        className="text-violet-600 hover:underline font-semibold"
                      >
                        Select All
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1 border border-neutral-200 rounded-xl">
                    {AVAILABLE_MODULES.map((mod) => {
                      const checked = newPermissions.includes(mod.id);
                      return (
                        <label
                          key={mod.id}
                          className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                            checked
                              ? "bg-violet-50/70 border-violet-300 text-violet-900"
                              : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePerm(mod.id, newPermissions, setNewPermissions)}
                            className="mt-0.5 rounded text-violet-600 focus:ring-violet-500"
                          />
                          <div>
                            <div className="font-bold text-[11px] leading-tight">{mod.label}</div>
                            <div className="text-[10px] text-neutral-500 leading-tight mt-0.5">{mod.desc}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={createMutation.isLoading}
                  className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isLoading}
                  className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  {createMutation.isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {createMutation.isLoading ? "Creating..." : "Create User & Permissions"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: EDIT PERMISSIONS MODAL */}
      {/* ========================================================================= */}
      {editingStaff && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto overscroll-contain"
          onClick={() => setEditingStaff(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-neutral-200 animate-in fade-in zoom-in-95 duration-150 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-neutral-900">
                  Edit Permissions: {editingStaff.name}
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5 font-mono">
                  {editingStaff.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                className="text-neutral-400 hover:text-neutral-600 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Role
                </label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 rounded-xl border border-neutral-200 p-2.5 flex-1 cursor-pointer">
                    <input
                      type="radio"
                      name="editRole"
                      value="HR"
                      checked={editRole === "HR"}
                      onChange={() => setEditRole("HR")}
                      className="text-violet-600"
                    />
                    <span className="font-bold text-neutral-900">HR / Executive HR</span>
                  </label>
                  <label className="flex items-center gap-2 rounded-xl border border-neutral-200 p-2.5 flex-1 cursor-pointer">
                    <input
                      type="radio"
                      name="editRole"
                      value="ADMIN"
                      checked={editRole === "ADMIN"}
                      onChange={() => setEditRole("ADMIN")}
                      className="text-violet-600"
                    />
                    <span className="font-bold text-neutral-900">Super Admin</span>
                  </label>
                </div>
              </div>

              {editRole === "HR" && (
                <div className="space-y-2 pt-2 border-t border-neutral-100">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-neutral-800">
                      Module Permissions:
                    </label>
                    <div className="flex gap-2 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setEditPerms(["dashboard", "attendance", "leave"])}
                        className="text-violet-600 hover:underline font-semibold"
                      >
                        Executive Preset
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditPerms(AVAILABLE_MODULES.map((m) => m.id))}
                        className="text-violet-600 hover:underline font-semibold"
                      >
                        Select All
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto p-1 border border-neutral-200 rounded-xl">
                    {AVAILABLE_MODULES.map((mod) => {
                      const checked = editPerms.includes(mod.id);
                      return (
                        <label
                          key={mod.id}
                          className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                            checked
                              ? "bg-violet-50/70 border-violet-300 text-violet-900"
                              : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePerm(mod.id, editPerms, setEditPerms)}
                            className="mt-0.5 rounded text-violet-600"
                          />
                          <div>
                            <div className="font-bold text-[11px] leading-tight">{mod.label}</div>
                            <div className="text-[10px] text-neutral-500 leading-tight mt-0.5">{mod.desc}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  disabled={updatePermMutation.isLoading}
                  className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditPerms}
                  disabled={updatePermMutation.isLoading}
                  className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  {updatePermMutation.isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {updatePermMutation.isLoading ? "Saving..." : "Save Permissions"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: RESET STAFF PASSWORD */}
      {/* ========================================================================= */}
      {passwordStaff && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overscroll-contain"
          onClick={() => setPasswordStaff(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-neutral-200 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-neutral-100 pb-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-neutral-900">
                  Change Password: {passwordStaff.name}
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5 font-mono">
                  {passwordStaff.email}
                </p>
              </div>
            </div>

            <form onSubmit={handleSavePassword} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-neutral-700 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showResetPass ? "text" : "password"}
                    value={resetPass}
                    onChange={(e) => setResetPass(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full rounded-xl border border-neutral-300 px-3.5 py-2.5 text-sm text-neutral-900 focus:border-violet-600 focus:outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPass(!showResetPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  >
                    {showResetPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setPasswordStaff(null)}
                  disabled={resetPasswordMutation.isLoading}
                  className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetPasswordMutation.isLoading}
                  className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  {resetPasswordMutation.isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {resetPasswordMutation.isLoading ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

