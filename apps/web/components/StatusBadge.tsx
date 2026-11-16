import { Badge } from "@/components/ui/badge";

const STATUS_VARIANT: Record<
  string,
  "success" | "warning" | "danger" | "info" | "secondary"
> = {
  ACTIVE: "success",
  ON_LEAVE: "info",
  RESIGNED: "secondary",
  TERMINATED: "danger",
  EXIT: "danger",
  PRESENT: "success",
  APPROVED: "success",
  LATE: "warning",
  PENDING: "warning",
  REJECTED: "danger",
  ABSENT: "danger",
};

const STATUS_LABELS: Record<string, string> = {
  EXIT: "Absconding",
  ACTIVE: "Active",
  ON_LEAVE: "On leave",
  RESIGNED: "Resigned",
  TERMINATED: "Terminated",
  PRESENT: "Present",
  APPROVED: "Approved",
  LATE: "Late",
  PENDING: "Pending",
  REJECTED: "Rejected",
  ABSENT: "Absent",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "secondary"}>
      {STATUS_LABELS[status] ?? status.replace("_", " ")}
    </Badge>
  );
}
