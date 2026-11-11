"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import {
  Building2,
  Plus,
  Globe,
  Users,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Lock,
  Mail,
  User,
  Palette,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { userFacingErrorMessage } from "@/lib/user-facing-error";

export default function OrganizationsPage() {
  const { data: session, status } = useSession();
  const isPlatformSuperAdmin =
    session?.user?.role === "ADMIN" &&
    (session?.user?.organizationId === "org_default_realty" || !session?.user?.organizationId);

  const utils = trpc.useUtils();
  const { data: orgs, isLoading } = trpc.organization.listAll.useQuery(undefined, {
    enabled: Boolean(isPlatformSuperAdmin),
  });

  const [isCreating, setIsCreating] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // New Organization Form States
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [brandColor, setBrandColor] = useState("#2563eb");
  const [adminFirstName, setAdminFirstName] = useState("");
  const [adminLastName, setAdminLastName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const createMutation = trpc.organization.create.useMutation({
    onSuccess: (data) => {
      setFeedback({
        type: "success",
        text: `Company "${data.organization.name}" successfully created! Admin login: ${data.adminUser.email}`,
      });
      setIsCreating(false);
      // Reset form
      setName("");
      setSlug("");
      setCustomDomain("");
      setAdminFirstName("");
      setAdminLastName("");
      setAdminEmail("");
      setAdminPassword("");
      utils.organization.listAll.invalidate();
    },
    onError: (err) => {
      setFeedback({
        type: "error",
        text: userFacingErrorMessage(err),
      });
    },
  });

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slug || slug === name.toLowerCase().replace(/[^a-z0-9]/g, "-")) {
      setSlug(
        val
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "")
      );
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      customDomain: customDomain.trim() || null,
      brandColor,
      adminFirstName: adminFirstName.trim(),
      adminLastName: adminLastName.trim(),
      adminEmail: adminEmail.trim().toLowerCase(),
      adminPassword,
    });
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSlug(id);
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-neutral-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-neutral-900 tracking-tight">
              Companies & Multi-Tenant Management
            </h1>
            <Badge className="bg-[#5D3EBC] text-white text-[10px] font-bold">
              Super Admin
            </Badge>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-neutral-500">
            Create, manage and onboard client companies onto independent portals with custom subdomains and branding.
          </p>
        </div>

        <Button
          onClick={() => setIsCreating(!isCreating)}
          className="bg-[#0F172A] hover:bg-neutral-800 text-white font-bold text-xs gap-2 shrink-0 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          {isCreating ? "Cancel" : "Onboard New Company"}
        </Button>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`rounded-xl border p-4 text-xs font-semibold flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
              : "bg-red-50 text-red-900 border-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-neutral-400 hover:text-neutral-600 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Onboard New Company Drawer / Form */}
      {isCreating && (
        <Card className="border-2 border-[#5D3EBC]/30 shadow-lg bg-gradient-to-br from-white to-purple-50/20">
          <CardHeader className="border-b border-neutral-100 pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-neutral-900">
              <Sparkles className="h-5 w-5 text-[#5D3EBC]" />
              Onboard a New Client Company
            </CardTitle>
            <CardDescription className="text-xs">
              Fill in the company details. The system will create an isolated tenant, seed company settings, and generate their primary Admin credentials.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            <form onSubmit={handleCreateSubmit} className="space-y-5">
              {/* Section 1: Company Profile */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#5D3EBC] mb-3 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" /> 1. Company Information & Branding
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-neutral-700">Company Name *</Label>
                    <Input
                      required
                      placeholder="e.g. Sharma Infrastructure Pvt Ltd"
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-neutral-700">
                      Subdomain Slug *
                    </Label>
                    <div className="flex items-center">
                      <Input
                        required
                        placeholder="e.g. sharma"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                        className="text-xs font-mono rounded-r-none"
                      />
                      <span className="bg-neutral-100 border border-l-0 border-neutral-200 text-neutral-500 text-[11px] px-2.5 py-2 rounded-r-lg font-mono">
                        .smartzhrms.com
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-neutral-700">Brand Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={brandColor}
                        onChange={(e) => setBrandColor(e.target.value)}
                        className="h-9 w-10 p-0.5 rounded border border-neutral-200 cursor-pointer"
                      />
                      <Input
                        type="text"
                        value={brandColor}
                        onChange={(e) => setBrandColor(e.target.value)}
                        className="text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-3 space-y-1.5">
                  <Label className="text-xs font-bold text-neutral-700">
                    Custom Domain (Optional)
                  </Label>
                  <Input
                    placeholder="e.g. hrms.sharmainfra.com"
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    className="text-xs font-mono"
                  />
                  <p className="text-[11px] text-neutral-400">
                    If client wants their own domain, they can point a CNAME to your application.
                  </p>
                </div>
              </div>

              {/* Section 2: Primary Admin Account */}
              <div className="pt-3 border-t border-neutral-200/60">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#5D3EBC] mb-3 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" /> 2. Primary HR / Admin Account
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-neutral-700">Admin First Name *</Label>
                    <Input
                      required
                      placeholder="e.g. Amit"
                      value={adminFirstName}
                      onChange={(e) => setAdminFirstName(e.target.value)}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-neutral-700">Admin Last Name *</Label>
                    <Input
                      required
                      placeholder="e.g. Sharma"
                      value={adminLastName}
                      onChange={(e) => setAdminLastName(e.target.value)}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-neutral-700">Admin Login Email *</Label>
                    <Input
                      required
                      type="email"
                      placeholder="e.g. hr@sharmainfra.com"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-neutral-700">Admin Initial Password *</Label>
                    <Input
                      required
                      type="password"
                      placeholder="Minimum 6 characters"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-200/60">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreating(false)}
                  className="text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isLoading}
                  className="bg-[#5D3EBC] hover:bg-[#4d32a3] text-white font-bold text-xs gap-2"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {createMutation.isLoading ? "Creating Portal..." : "Launch Organization"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Organizations Directory List */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-neutral-800">
          Registered Organizations ({orgs?.length || 0})
        </h3>

        {isLoading ? (
          <div className="p-8 text-center text-xs text-neutral-400">Loading organizations...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {orgs?.map((org) => {
              const isDefault = org.id === "org_default_realty";
              return (
                <Card
                  key={org.id}
                  className={`border transition-all hover:shadow-md ${
                    isDefault ? "border-purple-200 bg-purple-50/20" : "border-neutral-200 bg-white"
                  }`}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-xs"
                          style={{ backgroundColor: org.brandColor || "#7c3aed" }}
                        >
                          {org.name[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-neutral-900">{org.name}</h4>
                            {isDefault && (
                              <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 text-[9px] font-bold">
                                Default Primary
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-neutral-500 font-mono">
                            Slug: <b>{org.slug}</b>
                          </span>
                        </div>
                      </div>

                      <Badge
                        variant="outline"
                        className={
                          org.isActive
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 font-bold text-[10px]"
                            : "bg-neutral-100 text-neutral-600 font-bold text-[10px]"
                        }
                      >
                        {org.isActive ? "Active" : "Suspended"}
                      </Badge>
                    </div>

                    <div className="mt-4 pt-3 border-t border-neutral-100 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-neutral-400 block text-[11px]">Employees:</span>
                        <span className="font-bold text-neutral-800 flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-neutral-400" />
                          {org._count.employees} Staff Members
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-400 block text-[11px]">Subdomain:</span>
                        <span className="font-mono text-[11px] text-[#5D3EBC] font-semibold truncate block">
                          {org.slug}.smartzhrms.com
                        </span>
                      </div>
                    </div>

                    {org.customDomain && (
                      <div className="mt-2 text-xs flex items-center gap-1.5 text-neutral-600 bg-neutral-50 px-2.5 py-1.5 rounded-lg border border-neutral-100 font-mono text-[11px]">
                        <Globe className="h-3.5 w-3.5 text-blue-500" />
                        Custom Domain: <b>{org.customDomain}</b>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Guide Card: How to Test & Deploy on Domain */}
      <Card className="border-neutral-200 bg-neutral-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-neutral-600 flex items-center gap-1.5">
            <Globe className="h-4 w-4 text-[#5D3EBC]" />
            Deployment & Testing Quick Reference
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-2 text-neutral-600">
          <p>
            <b>1. How to Test Locally:</b> Open your Windows <code>hosts</code> file (<code>C:\Windows\System32\drivers\etc\hosts</code>) and add: <code className="bg-white px-1.5 py-0.5 rounded border">127.0.0.1 sharma.localhost</code>. Then visit <code className="bg-white px-1.5 py-0.5 rounded border">http://sharma.localhost:3000/login</code> to test the newly created company with zero domain cost!
          </p>
          <p>
            <b>2. How to Live on Wildcard Subdomains:</b> In your DNS provider (Cloudflare / GoDaddy / Vercel), add a CNAME record: <b>Name:</b> <code>*</code> pointing to your app domain. All client subdomains (e.g. <code>sharma.yourdomain.com</code>) will automatically route without manual DNS setup.
          </p>
          <p>
            <b>3. How to Live on Client's Custom Domain:</b> Ask the client to add a CNAME record in their DNS: <b>Host:</b> <code>hrms</code> pointing to <code>yourdomain.com</code>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

