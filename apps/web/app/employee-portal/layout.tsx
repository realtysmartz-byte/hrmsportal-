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
    <div className="min-h-screen bg-[#F6F8FB]">
      <EmployeeTopNav />
      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-5 sm:py-6 md:px-6 md:py-8 pb-24 lg:pb-8">
        {children}
      </main>
    </div>
  );
}
