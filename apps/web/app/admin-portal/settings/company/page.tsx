"use client";

import { userFacingErrorMessage } from "@/lib/user-facing-error";
import { FormEvent, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import {
  geolocationErrorMessage,
  getCurrentPosition,
} from "@/lib/geolocation";
import { canManageCompanySettings } from "@realty-smartz/shared";
import type { Role } from "@realty-smartz/shared";
import Link from "next/link";
import {
  FileSpreadsheet,
  Mail,
  Palette,
  MapPin,
  Sparkles,
  ExternalLink,
  Eye,
  Check,
  Building2,
  ImageIcon,
  UploadCloud,
  Loader2,
  Smartphone,
  Copy,
} from "lucide-react";
import { LocationMap } from "@/components/LocationMap";

const BRAND_PRESETS = [
  { label: "Purple", hex: "#7c3aed" },
  { label: "Indigo", hex: "#4f46e5" },
  { label: "Blue", hex: "#0284c7" },
  { label: "Emerald", hex: "#059669" },
  { label: "Amber", hex: "#d97706" },
  { label: "Rose", hex: "#e11d48" },
  { label: "Dark Violet", hex: "#5D3EBC" },
];

export default function CompanySettingsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const role = (session?.user?.role ?? "EMPLOYEE") as Role;
  const allowed = canManageCompanySettings(role);

  const [activeTab, setActiveTab] = useState<"branding" | "geofence" | "integrations">("branding");

  // Geofence data & mutation
  const { data: geofenceData, isLoading: geofenceLoading } = trpc.companySettings.get.useQuery(undefined, {
    enabled: allowed,
  });
  // Organization branding data & mutation
  const { data: orgData, isLoading: orgLoading } = trpc.organization.getCurrent.useQuery(undefined, {
    enabled: allowed,
  });

  const utils = trpc.useUtils();

  // Branding state
  const [orgName, setOrgName] = useState("");
  const [brandColor, setBrandColor] = useState("#7c3aed");
  const [logoUrl, setLogoUrl] = useState("");
  const [loginHeading, setLoginHeading] = useState("");
  const [loginSubheading, setLoginSubheading] = useState("");
  const [loginBannerUrl, setLoginBannerUrl] = useState("");
  const [tagline, setTagline] = useState("");
  const [testimonialQuote, setTestimonialQuote] = useState("");
  const [testimonialAuthor, setTestimonialAuthor] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [customDomain, setCustomDomain] = useState("");

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [brandingSuccess, setBrandingSuccess] = useState("");
  const [brandingError, setBrandingError] = useState("");

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, type: "logo" | "banner") {
    const file = e.target.files?.[0];
    if (!file) return;

    const isLogo = type === "logo";
    if (isLogo) setUploadingLogo(true);
    else setUploadingBanner(true);
    setBrandingError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to upload image");
      }
      if (isLogo) {
        setLogoUrl(data.url);
      } else {
        setLoginBannerUrl(data.url);
      }
    } catch (err: any) {
      setBrandingError(err.message || "Image upload failed");
    } finally {
      if (isLogo) setUploadingLogo(false);
      else setUploadingBanner(false);
      e.target.value = "";
    }
  }

  // Geofence state
  const [officeName, setOfficeName] = useState("");
  const [officeLat, setOfficeLat] = useState("");
  const [officeLng, setOfficeLng] = useState("");
  const [geofenceRadiusM, setGeofenceRadiusM] = useState("200");
  const [geofenceError, setGeofenceError] = useState("");
  const [geofenceSuccess, setGeofenceSuccess] = useState("");

  useEffect(() => {
    if (status === "authenticated" && !allowed) {
      router.replace("/admin-portal/dashboard");
    }
  }, [status, allowed, router]);

  useEffect(() => {
    if (orgData) {
      setOrgName(orgData.name || "");
      setBrandColor(orgData.brandColor || "#7c3aed");
      setLogoUrl(orgData.logoUrl || "");
      setLoginHeading(orgData.loginHeading || "");
      setLoginSubheading(orgData.loginSubheading || "");
      setLoginBannerUrl(orgData.loginBannerUrl || "");
      setTagline(orgData.tagline || "");
      setTestimonialQuote(orgData.testimonialQuote || "");
      setTestimonialAuthor(orgData.testimonialAuthor || "");
      setOrgSlug(orgData.slug || "");
      setCustomDomain(orgData.customDomain || "");
    }
  }, [orgData]);

  useEffect(() => {
    if (geofenceData) {
      setOfficeName(geofenceData.officeName);
      setOfficeLat(String(geofenceData.officeLat));
      setOfficeLng(String(geofenceData.officeLng));
      setGeofenceRadiusM(String(geofenceData.geofenceRadiusM));
    }
  }, [geofenceData]);

  const updateBranding = trpc.organization.updateCurrent.useMutation({
    onSuccess: () => {
      setBrandingSuccess("Branding & custom login settings updated successfully!");
      setBrandingError("");
      utils.organization.getCurrent.invalidate();
    },
    onError: (err) => {
      setBrandingError(userFacingErrorMessage(err));
      setBrandingSuccess("");
    },
  });

  const updateGeofence = trpc.companySettings.update.useMutation({
    onSuccess: () => {
      setGeofenceSuccess("Office geofence settings saved.");
      setGeofenceError("");
      utils.companySettings.get.invalidate();
    },
    onError: (err) => {
      setGeofenceError(userFacingErrorMessage(err));
      setGeofenceSuccess("");
    },
  });

  function onSaveBranding(e: FormEvent) {
    e.preventDefault();
    setBrandingSuccess("");
    setBrandingError("");
    updateBranding.mutate({
      name: orgName.trim(),
      brandColor: brandColor.trim(),
      logoUrl: logoUrl.trim() || null,
      customDomain: customDomain.trim() || null,
      loginHeading: loginHeading.trim() || null,
      loginSubheading: loginSubheading.trim() || null,
      loginBannerUrl: loginBannerUrl.trim() || null,
      tagline: tagline.trim() || null,
      testimonialQuote: testimonialQuote.trim() || null,
      testimonialAuthor: testimonialAuthor.trim() || null,
    });
  }

  async function useMyLocation() {
    setGeofenceError("");
    try {
      const pos = await getCurrentPosition();
      setOfficeLat(String(pos.coords.latitude));
      setOfficeLng(String(pos.coords.longitude));
    } catch (err) {
      setGeofenceError(geolocationErrorMessage(err));
    }
  }

  function onSaveGeofence(e: FormEvent) {
    e.preventDefault();
    setGeofenceSuccess("");
    setGeofenceError("");
    updateGeofence.mutate({
      officeName: officeName.trim(),
      officeLat: parseFloat(officeLat),
      officeLng: parseFloat(officeLng),
      geofenceRadiusM: parseInt(geofenceRadiusM, 10),
    });
  }

  if (status === "loading" || !allowed || geofenceLoading || orgLoading) {
    return <p className="text-sm text-muted-foreground p-6">Loading company settings...</p>;
  }

  const liveLoginUrl = orgSlug ? `/login?org=${encodeURIComponent(orgSlug)}` : "/login";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-900 tracking-tight">
            Company & Tenant Customization
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-neutral-500">
            White-label branding, customized login page, and attendance geofencing.
          </p>
        </div>
        <a
          href={liveLoginUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 text-xs font-bold transition-all shadow-sm"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Preview Live Login Page
        </a>
      </div>

      {/* Modern Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("branding")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === "branding"
              ? "bg-[#5D3EBC] text-white shadow-sm"
              : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
          }`}
        >
          <Palette className="h-4 w-4" />
          Branding & Login Customizer
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("geofence")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === "geofence"
              ? "bg-[#5D3EBC] text-white shadow-sm"
              : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
          }`}
        >
          <MapPin className="h-4 w-4" />
          Office Location & Geofence
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("integrations")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === "integrations"
              ? "bg-[#5D3EBC] text-white shadow-sm"
              : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Integrations & Reports
        </button>
      </div>

      {/* TAB 1: BRANDING & LOGIN CUSTOMIZER */}
      {activeTab === "branding" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Form Settings Column (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <Card className="rounded-2xl border border-neutral-200/80 bg-white shadow-sm overflow-hidden">
              <CardHeader className="p-5 sm:p-6 pb-3 border-b border-neutral-100 bg-neutral-50/50">
                <CardTitle className="text-base font-bold text-neutral-900 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#5D3EBC]" />
                  White-label Branding & Login Design
                </CardTitle>
                <CardDescription className="text-xs text-neutral-500">
                  Each tenant has complete freedom to customize their logo, cover photo, title, and brand colors.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 sm:p-6 space-y-5">
                <form onSubmit={onSaveBranding} className="space-y-4">
                  {/* Company Display Name */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-neutral-700">Company Name</Label>
                    <Input
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="e.g. Smart Spaces Inc."
                      required
                    />
                  </div>

                  {/* Brand Theme Color */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-neutral-700">
                      Primary Brand Color
                    </Label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={brandColor}
                        onChange={(e) => setBrandColor(e.target.value)}
                        className="h-10 w-12 rounded-lg border border-neutral-200 cursor-pointer p-0.5 bg-white"
                      />
                      <Input
                        value={brandColor}
                        onChange={(e) => setBrandColor(e.target.value)}
                        placeholder="#7c3aed"
                        className="font-mono text-xs max-w-[120px]"
                      />
                      {/* Presets */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {BRAND_PRESETS.map((p) => (
                          <button
                            key={p.hex}
                            type="button"
                            onClick={() => setBrandColor(p.hex)}
                            title={p.label}
                            style={{ backgroundColor: p.hex }}
                            className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                              brandColor.toLowerCase() === p.hex.toLowerCase()
                                ? "border-neutral-900 ring-2 ring-neutral-400"
                                : "border-white"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Company Logo Upload & URL */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-neutral-700">
                        Company Logo (Upload JPG, PNG, WebP, SVG)
                      </Label>
                      {logoUrl && (
                        <button
                          type="button"
                          onClick={() => setLogoUrl("")}
                          className="text-[11px] text-rose-600 hover:underline font-medium"
                        >
                          Reset to Default Logo
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                      {/* Logo Preview Square */}
                      <div className="h-16 w-20 rounded-xl border border-neutral-200 bg-neutral-50 flex items-center justify-center overflow-hidden shrink-0 p-1.5 shadow-inner">
                        {logoUrl ? (
                          <img
                            src={logoUrl}
                            alt="Logo"
                            className="max-h-full max-w-full object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "/logo.png";
                            }}
                          />
                        ) : (
                          <Building2 className="h-6 w-6 text-neutral-400" />
                        )}
                      </div>

                      <div className="space-y-1.5 flex-1 w-full">
                        <div className="flex items-center gap-2">
                          <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-700 text-xs font-semibold shadow-sm transition-all">
                            {uploadingLogo ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                                <span>Uploading...</span>
                              </>
                            ) : (
                              <>
                                <UploadCloud className="h-3.5 w-3.5 text-indigo-600" />
                                <span>Upload JPG / PNG / SVG</span>
                              </>
                            )}
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                              className="hidden"
                              disabled={uploadingLogo}
                              onChange={(e) => handleFileUpload(e, "logo")}
                            />
                          </label>
                          <span className="text-[11px] text-neutral-400">or paste image URL:</span>
                        </div>
                        <Input
                          value={logoUrl}
                          onChange={(e) => setLogoUrl(e.target.value)}
                          placeholder="https://example.com/logo.png or /uploads/..."
                          className="text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Login Heading & Subtitle */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-neutral-700">Login Welcome Heading</Label>
                      <Input
                        value={loginHeading}
                        onChange={(e) => setLoginHeading(e.target.value)}
                        placeholder="e.g. Welcome back"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-neutral-700">Tagline Badge</Label>
                      <Input
                        value={tagline}
                        onChange={(e) => setTagline(e.target.value)}
                        placeholder="e.g. SMART SPACES WORKSPACE"
                      />
                    </div>
                  </div>

                  {/* Login Subtitle */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-neutral-700">Login Subtitle / Description</Label>
                    <Input
                      value={loginSubheading}
                      onChange={(e) => setLoginSubheading(e.target.value)}
                      placeholder="e.g. Please enter your account details to access your workspace"
                    />
                  </div>

                  {/* Cover Photo / Right Column Banner URL & Upload */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-neutral-700">
                        Login Cover Photo / Banner (Upload JPG, PNG, WebP)
                      </Label>
                      {loginBannerUrl && (
                        <button
                          type="button"
                          onClick={() => setLoginBannerUrl("")}
                          className="text-[11px] text-rose-600 hover:underline font-medium"
                        >
                          Remove Photo
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                      {/* Banner Preview */}
                      <div className="h-16 w-24 rounded-xl border border-neutral-200 bg-neutral-50 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                        {loginBannerUrl ? (
                          <img
                            src={loginBannerUrl}
                            alt="Banner"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="h-6 w-6 text-neutral-400" />
                        )}
                      </div>

                      <div className="space-y-1.5 flex-1 w-full">
                        <div className="flex items-center gap-2">
                          <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-700 text-xs font-semibold shadow-sm transition-all">
                            {uploadingBanner ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                                <span>Uploading...</span>
                              </>
                            ) : (
                              <>
                                <UploadCloud className="h-3.5 w-3.5 text-indigo-600" />
                                <span>Upload JPG / PNG Photo</span>
                              </>
                            )}
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/jpg,image/webp"
                              className="hidden"
                              disabled={uploadingBanner}
                              onChange={(e) => handleFileUpload(e, "banner")}
                            />
                          </label>
                          <span className="text-[11px] text-neutral-400">or paste banner URL:</span>
                        </div>
                        <Input
                          value={loginBannerUrl}
                          onChange={(e) => setLoginBannerUrl(e.target.value)}
                          placeholder="https://images.unsplash.com/... or /uploads/..."
                          className="text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Testimonial Quote & Author */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-neutral-700">
                      Custom Welcome Quote / Team Mission
                    </Label>
                    <Input
                      value={testimonialQuote}
                      onChange={(e) => setTestimonialQuote(e.target.value)}
                      placeholder="e.g. Innovating property technology and seamless employee operations."
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-neutral-700">
                      Quote Author / Department
                    </Label>
                    <Input
                      value={testimonialAuthor}
                      onChange={(e) => setTestimonialAuthor(e.target.value)}
                      placeholder="e.g. Smart Spaces Leadership Team"
                    />
                  </div>

                  {brandingError && (
                    <p className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-medium text-rose-600">
                      {brandingError}
                    </p>
                  )}
                  {brandingSuccess && (
                    <p className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-medium text-emerald-600">
                      {brandingSuccess}
                    </p>
                  )}

                  <Button
                    type="submit"
                    disabled={updateBranding.isLoading}
                    style={{ backgroundColor: brandColor || "#5D3EBC" }}
                    className="w-full text-white font-bold py-2.5 rounded-xl transition-opacity hover:opacity-95"
                  >
                    {updateBranding.isLoading ? "Saving Customization..." : "Save Branding & Login Design"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Live Mockup / Preview Column (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="sticky top-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-indigo-600" />
                  Live Login Preview
                </span>
                <span className="text-[11px] text-neutral-400">Updates in real time</span>
              </div>

              {/* Realistic Mockup Box */}
              <div className="rounded-2xl border border-neutral-800 bg-[#0C0D14] p-4 text-white shadow-2xl relative overflow-hidden">
                {/* Simulated split card */}
                <div className="rounded-xl border border-white/10 bg-[#181926] p-4 space-y-4">
                  {/* Brand header */}
                  <div className="flex items-center gap-2.5">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt="Logo"
                        className="h-8 w-auto max-h-8 max-w-[100px] object-contain rounded"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/logo.png";
                        }}
                      />
                    ) : (
                      <div
                        className="h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs text-white"
                        style={{ backgroundColor: brandColor }}
                      >
                        {orgName ? orgName.slice(0, 2).toUpperCase() : "RS"}
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-xs text-white tracking-wide uppercase">
                        {orgName || "Company Name"}
                      </p>
                      <p className="text-[9px] text-neutral-400">Workspace Portal</p>
                    </div>
                  </div>

                  {/* Heading & Subtitle */}
                  <div className="space-y-0.5">
                    <p className="font-extrabold text-sm text-white">
                      {loginHeading || "Welcome back"}
                    </p>
                    <p className="text-[10px] text-neutral-400 leading-tight">
                      {loginSubheading || "Please enter your account details to access your workspace"}
                    </p>
                  </div>

                  {/* Tagline Capsule */}
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-[#11121A] px-2.5 py-1 border border-white/10 text-[9px] text-neutral-300">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: brandColor }} />
                    <span>{tagline || "UNIVERSAL SIGN-IN"}</span>
                  </div>

                  {/* Mock Input fields */}
                  <div className="space-y-2 text-[10px]">
                    <div className="rounded-md border border-white/10 bg-[#11121A] px-2.5 py-1.5 text-neutral-400">
                      employee@company.com
                    </div>
                    <div className="rounded-md border border-white/10 bg-[#11121A] px-2.5 py-1.5 text-neutral-400">
                      ••••••••
                    </div>
                  </div>

                  {/* Mock Submit button */}
                  <div
                    className="w-full py-2 rounded-full text-center text-xs font-bold text-white shadow-md"
                    style={{
                      backgroundColor: brandColor,
                      boxShadow: `0 4px 14px 0 ${brandColor}66`,
                    }}
                  >
                    Sign in
                  </div>

                  {/* Right side banner preview note */}
                  {loginBannerUrl && (
                    <div className="relative rounded-lg overflow-hidden h-24 border border-white/10 mt-3">
                      <img
                        src={loginBannerUrl}
                        alt="Banner Preview"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-[#0C0D14]/70 p-2 flex flex-col justify-end">
                        <p className="text-[9px] text-white font-medium italic truncate">
                          "{testimonialQuote || "Custom Team Quote"}"
                        </p>
                        <p className="text-[8px] text-neutral-300">
                          {testimonialAuthor || orgName}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-3 text-center">
                  <p className="text-[10px] text-neutral-400">
                    Tenant Code / Slug: <span className="font-mono text-neutral-200">{orgSlug}</span>
                  </p>
                </div>

                {/* Mobile APK Multi-Tenant Guide */}
                <div className="mt-4 rounded-xl border border-white/10 bg-[#11121A] p-3.5 space-y-2.5 text-left">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-indigo-400" />
                    <h4 className="text-xs font-bold text-white">
                      Mobile APK Onboarding
                    </h4>
                  </div>
                  <p className="text-[10px] text-neutral-400 leading-relaxed">
                    Android APK users can lock their app to this workspace in two seamless ways:
                  </p>
                  <ul className="text-[10px] text-neutral-300 space-y-1.5 list-disc pl-4">
                    <li>
                      <span className="font-medium text-white">Company Code:</span> On the login screen, tap <strong>"Workspace (Change)"</strong> and type <code className="bg-white/10 text-indigo-300 px-1 py-0.5 rounded font-mono">{orgSlug}</code> once.
                    </li>
                    <li>
                      <span className="font-medium text-white">Direct WhatsApp / Email Link:</span> Click link to open APK directly.
                    </li>
                  </ul>
                  <div className="flex items-center gap-1.5 bg-[#0C0D14] rounded-lg border border-white/10 p-1.5">
                    <code className="text-[9px] text-neutral-300 truncate flex-1 font-mono">
                      {typeof window !== "undefined" ? `${window.location.origin}/login?org=${orgSlug}` : `/login?org=${orgSlug}`}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        const link = `${window.location.origin}/login?org=${orgSlug}`;
                        navigator.clipboard.writeText(link);
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2000);
                      }}
                      className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-[9px] font-bold text-white flex items-center gap-1 shrink-0 transition-colors"
                    >
                      {copiedLink ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedLink ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: OFFICE LOCATION & GEOFENCE */}
      {activeTab === "geofence" && (
        <Card className="rounded-2xl border border-neutral-200/80 bg-white shadow-sm overflow-hidden">
          <CardHeader className="p-5 sm:p-6 pb-2 border-b border-neutral-100 bg-neutral-50/50">
            <CardTitle className="font-display text-base font-bold text-neutral-900">
              Office Geofence & Punch Boundary
            </CardTitle>
            <CardDescription className="text-xs text-neutral-500">
              Staff within this geographic radius are authorized to log mobile attendance check-ins.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 sm:p-6 pt-4 space-y-5">
            <form onSubmit={onSaveGeofence} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-neutral-700">Office Name</Label>
                <Input
                  value={officeName}
                  onChange={(e) => setOfficeName(e.target.value)}
                  placeholder="e.g. Headquarters Office"
                  required
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-neutral-700">Latitude</Label>
                  <Input
                    type="number"
                    step="any"
                    value={officeLat}
                    onChange={(e) => setOfficeLat(e.target.value)}
                    placeholder="28.4595"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-neutral-700">Longitude</Label>
                  <Input
                    type="number"
                    step="any"
                    value={officeLng}
                    onChange={(e) => setOfficeLng(e.target.value)}
                    placeholder="77.0266"
                    required
                  />
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={useMyLocation}
                className="rounded-xl border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
              >
                Use My Current GPS Location
              </Button>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-neutral-700">Geofence Radius (meters)</Label>
                <Input
                  type="number"
                  min={50}
                  max={5000}
                  value={geofenceRadiusM}
                  onChange={(e) => setGeofenceRadiusM(e.target.value)}
                  required
                />
              </div>

              <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 p-3.5 text-xs text-amber-900">
                <p className="font-bold flex items-center gap-1.5">
                  <span>Weekly Off: Tuesday</span>
                </p>
                <p className="mt-1 text-amber-800/80 leading-relaxed">
                  Saturday and Sunday are standard working days. Leave and attendance tracking calendars skip Tuesday only.
                </p>
              </div>

              {geofenceError && (
                <p className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-medium text-rose-600">
                  {geofenceError}
                </p>
              )}
              {geofenceSuccess && (
                <p className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-medium text-emerald-600">
                  {geofenceSuccess}
                </p>
              )}

              <Button
                type="submit"
                disabled={updateGeofence.isLoading}
                className="w-full rounded-xl bg-[#5D3EBC] py-2.5 text-xs sm:text-sm font-bold text-white hover:opacity-95"
              >
                {updateGeofence.isLoading ? "Saving Settings..." : "Save Office Geofence"}
              </Button>
            </form>

            {officeLat && officeLng && !Number.isNaN(parseFloat(officeLat)) && (
              <div className="mt-4 rounded-xl overflow-hidden border border-neutral-200">
                <LocationMap
                  lat={parseFloat(officeLat)}
                  lng={parseFloat(officeLng)}
                  label={officeName || "Office"}
                  height={220}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB 3: INTEGRATIONS & SYNC */}
      {activeTab === "integrations" && (
        <div className="space-y-4">
          <Card className="rounded-2xl border-neutral-200/80 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border">
            <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-bold text-neutral-900 text-sm">
                    Google Sheets Daily Report Sync
                  </h4>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Automatically generate a new date tab daily in your Google Sheet with full employee attendance and hours.
                  </p>
                </div>
              </div>
              <Link href="/admin-portal/settings/google-sheets" className="shrink-0">
                <Button size="sm" className="bg-[#181C26] hover:bg-neutral-800 text-white font-bold text-xs gap-1.5 w-full sm:w-auto">
                  View Sync Status →
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-neutral-200/80 bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent border">
            <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
                  <Mail className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="font-bold text-neutral-900 text-sm">
                    Email Notification Service
                  </h4>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Verify mail deliverability, check service status, and test automated punch and welcome notifications.
                  </p>
                </div>
              </div>
              <Link href="/admin-portal/settings/email" className="shrink-0">
                <Button size="sm" className="bg-[#181C26] hover:bg-neutral-800 text-white font-bold text-xs gap-1.5 w-full sm:w-auto">
                  View Email Service →
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
