import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-ivory px-6 py-24 text-center">
      <p className="font-display text-7xl font-bold text-saffron">404</p>
      <h1 className="mt-4 font-display text-3xl font-semibold text-walnut">This page wandered off</h1>
      <p className="mt-2 max-w-md text-sm text-muted">The page you&apos;re looking for doesn&apos;t exist or may have moved.</p>
      <div className="mt-8 flex gap-3">
        <Link href="/" className="btn-primary">Go home</Link>
        <Link href="/shop" className="btn-outline">Browse products</Link>
      </div>
    </main>
  );
}
