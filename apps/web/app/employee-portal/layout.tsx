import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { EmployeeTopNav } from "@/components/EmployeeTopNav";
import { EmployeePortalFooter } from "@/components/EmployeePortalFooter";
import { PwaInstallBanner } from "@/components/PwaInstallBanner";
import { EmployeePolicyAgreementModal } from "@/components/EmployeePolicyAgreementModal";
import { authOptions } from "@/lib/auth";
import { canAccessAdminPortal } from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";

export const dynamic = "force-dynamic";

export default async function EmployeePortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.error === "AccountInactive") {
    redirect("/login?error=AccountInactive");
  }
  if (session.error === "SessionExpired") {
    redirect("/login?error=SessionExpired");
  }

  const role = (session.user.role || "EMPLOYEE") as Role;
  const isAdmin = canAccessAdminPortal(role);

  return (
    <div className="min-h-screen min-h-dvh bg-white text-[var(--ink)]">
      <EmployeePolicyAgreementModal />
      {!isAdmin && <PwaInstallBanner />}
      <EmployeeTopNav />
      <main
        className="mx-auto max-w-[430px] px-4 py-4"
        style={{
          paddingBottom: "calc(6rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        {children}
        <EmployeePortalFooter />
      </main>
    </div>
  );
}
