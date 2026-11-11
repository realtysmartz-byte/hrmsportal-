import Link from "next/link";

export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0c0d14] text-white p-6 text-center">
      <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center text-2xl font-bold shadow-xl mb-4">
        404
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-white">Page Not Found</h1>
      <p className="mt-2 text-sm text-neutral-400 max-w-sm">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/login"
        className="mt-6 px-5 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/30"
      >
        Back to Login
      </Link>
    </div>
  );
}

