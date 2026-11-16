import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg)] text-[var(--ink)] p-6 text-center font-sans">
      <div className="w-full max-w-md rounded border border-[var(--line)] bg-[var(--card)] p-8 shadow-sm">
        <div className="h-14 w-14 rounded bg-[var(--field)] border border-[var(--line)] flex items-center justify-center text-xl font-bold text-[var(--accent)] mx-auto mb-4">
          404
        </div>
        <h1 className="text-xl font-bold tracking-tight text-[var(--ink)]">Page not found</h1>
        <p className="mt-2 text-xs text-[var(--muted)]">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            href="/login"
            className="btn-chamfer inline-flex items-center justify-center px-6 h-11 bg-[var(--accent)] text-white text-xs font-semibold hover:brightness-110 transition-all"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
