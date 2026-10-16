import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { AdminPortalShell } from "@/components/AdminPortalShell";
import { authOptions } from "@/lib/auth";
import { canAccessAdminPortal } from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";

export default async function AdminPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.error === "AccountInactive") {
    redirect("/login?error=AccountInactive");
  }

  if (!canAccessAdminPortal(session.user.role as Role)) {
    redirect("/employee-portal/dashboard");
  }

  return (
    <AdminPortalShell>
      {children}
    </AdminPortalShell>
  );
}
