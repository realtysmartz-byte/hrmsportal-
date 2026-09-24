import { Badge } from "@/components/ui/badge";

const STATUS_VARIANT: Record<
  string,
  "success" | "warning" | "danger" | "secondary"
> = {
  ACTIVE: "success",
  ON_LEAVE: "warning",
  RESIGNED: "secondary",
  TERMINATED: "danger",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "secondary"}>
      {status.replace("_", " ")}
    </Badge>
  );
}
