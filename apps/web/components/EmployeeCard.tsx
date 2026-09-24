import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { cn, fullName, initials } from "@/lib/utils";

type EmployeeCardProps = {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  profilePhotoUrl?: string | null;
  designation?: { title: string } | null;
  department?: { name: string } | null;
  status?: string;
  className?: string;
  hrefBase?: string;
};

export function EmployeeCard({
  id,
  firstName,
  lastName,
  employeeCode,
  profilePhotoUrl,
  designation,
  department,
  status,
  className,
  hrefBase = "/admin-portal/employees",
}: EmployeeCardProps) {
  return (
    <Link
      href={`${hrefBase}/${id}`}
      className={cn(
        "flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3 transition-colors hover:bg-neutral-50",
        className
      )}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-teal/15 text-sm font-semibold text-brand-teal">
        {profilePhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profilePhotoUrl}
            alt={fullName(firstName, lastName)}
            className="h-full w-full object-cover"
          />
        ) : (
          initials(firstName, lastName)
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{fullName(firstName, lastName)}</p>
        <p className="truncate text-xs text-muted-foreground">
          {designation?.title ?? "—"}
          {department ? ` · ${department.name}` : ""}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            {employeeCode}
          </Badge>
          {status && <StatusBadge status={status} />}
        </div>
      </div>
    </Link>
  );
}
