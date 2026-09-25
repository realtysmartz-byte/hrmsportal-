import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { EmployeeTopNav } from "@/components/EmployeeTopNav";
import { LocationTracker } from "@/components/LocationTracker";
import { PwaInstallBanner } from "@/components/PwaInstallBanner";
import { authOptions } from "@/lib/auth";

export default async function EmployeePortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?portal=employee");

  return (
    <div className="min-h-screen bg-[#F6F8FB] pb-[env(safe-area-inset-bottom)]">
      <PwaInstallBanner />
      <EmployeeTopNav />
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        {children}
      </main>
      <LocationTracker />
    </div>
  );
}
