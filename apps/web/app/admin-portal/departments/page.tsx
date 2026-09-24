"use client";

import { FormEvent, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { canManageOrg } from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";

export default function DepartmentsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const role = (session?.user?.role ?? "EMPLOYEE") as Role;
  const allowed = canManageOrg(role);

  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState("");

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.department.list.useQuery(undefined, {
    enabled: status === "authenticated" && allowed,
  });

  useEffect(() => {
    if (status === "authenticated" && !allowed) {
      router.replace("/admin-portal/dashboard");
    }
  }, [status, allowed, router]);

  const createMutation = trpc.department.create.useMutation({
    onSuccess: () => {
      setName("");
      setError("");
      utils.department.list.invalidate();
    },
    onError: (err) => setError(err.message),
  });

  const updateMutation = trpc.department.update.useMutation({
    onSuccess: () => {
      setEditingId(null);
      setError("");
      utils.department.list.invalidate();
    },
    onError: (err) => setError(err.message),
  });

  const deleteMutation = trpc.department.delete.useMutation({
    onSuccess: () => utils.department.list.invalidate(),
    onError: (err) => setError(err.message),
  });

  if (status === "loading" || !allowed) {
    return <p className="text-sm text-muted-foreground">Loading...</p>;
  }

  function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({ name: name.trim() });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Departments</h1>
        <p className="text-muted-foreground">Manage company departments</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add Department</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="flex flex-wrap gap-3">
            <Input
              className="max-w-sm"
              placeholder="Department name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button type="submit" disabled={createMutation.isLoading} className="gap-2">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-brand-maroon">{error}</p>}

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Employees</TableHead>
              <TableHead className="w-40">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={3}>Loading...</TableCell>
              </TableRow>
            )}
            {data?.map((dept) => (
              <TableRow key={dept.id}>
                <TableCell>
                  {editingId === dept.id ? (
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="max-w-xs"
                    />
                  ) : (
                    dept.name
                  )}
                </TableCell>
                <TableCell>{dept._count.employees}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    {editingId === dept.id ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() =>
                            updateMutation.mutate({
                              id: dept.id,
                              name: editName.trim(),
                            })
                          }
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => {
                            setEditingId(dept.id);
                            setEditName(dept.name);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="destructive"
                          onClick={() => {
                            if (confirm(`Delete department "${dept.name}"?`)) {
                              deleteMutation.mutate({ id: dept.id });
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
