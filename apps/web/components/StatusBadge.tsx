import { Badge } from "@/components/ui/badge";

const STATUS_VARIANT: Record<
  string,
  "success" | "warning" | "danger" | "secondary"
> = {
  ACTIVE: "success",
  ON_LEAVE: "warning",
  RESIGNED: "secondary",
  TERMINATED: "danger",
  EXIT: "danger",
};

const STATUS_LABELS: Record<string, string> = {
  EXIT: "Absconding",
  ACTIVE: "Active",
  ON_LEAVE: "On Leave",
  RESIGNED: "Resigned",
  TERMINATED: "Terminated",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "secondary"}>
      {STATUS_LABELS[status] ?? status.replace("_", " ")}
    </Badge>
  );
}
