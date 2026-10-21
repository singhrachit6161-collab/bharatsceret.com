"use client";

import Link from "next/link";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="font-display text-3xl font-semibold text-walnut">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted">Please try again. If the problem continues, contact support.</p>
      <div className="mt-6 flex gap-3">
        <button type="button" onClick={reset} className="btn-primary">Try again</button>
        <Link href="/" className="btn-outline">Go home</Link>
      </div>
    </main>
  );
}
