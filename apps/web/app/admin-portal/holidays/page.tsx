import { redirect } from "next/navigation";

export default function AdminHolidaysRedirectPage() {
  redirect("/admin-portal/settings/holidays");
}
