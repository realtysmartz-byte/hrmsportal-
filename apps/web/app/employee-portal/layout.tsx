import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { EmployeeTopNav } from "@/components/EmployeeTopNav";
import { authOptions } from "@/lib/auth";

export default async function EmployeePortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="min-h-dvh bg-white lg:bg-[#F4F5FA]">
      <EmployeeTopNav />
      <main
        className="mx-auto max-w-7xl px-3 py-4 sm:px-5 sm:py-6 md:px-6 md:py-8 lg:pb-20"
        style={{
          // Bottom tabs (~64px) + GPS badge + Android gesture/safe area — prevents cut-off in APK
          paddingBottom: "calc(7.5rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        {children}
      </main>
    </div>
  );
}
