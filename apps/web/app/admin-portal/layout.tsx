import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AdminSidebar } from "@/components/AdminSidebar";
import { authOptions } from "@/lib/auth";
import { canAccessAdminPortal } from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";

export default async function AdminPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?portal=admin");

  if (!canAccessAdminPortal(session.user.role as Role)) {
    redirect("/employee-portal/dashboard");
  }

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <div className="hidden lg:block">
        <AdminSidebar />
      </div>
      <div className="flex min-h-screen flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:hidden">
          <p className="font-display text-sm font-bold text-teal-800">
            Admin Portal
          </p>
          <a
            href="/employee-portal/dashboard"
            className="text-caption font-semibold text-teal-700"
          >
            Employee view
          </a>
        </div>
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-7xl p-4 md:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
