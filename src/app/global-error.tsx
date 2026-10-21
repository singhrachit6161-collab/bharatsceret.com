"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-IN">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#FFF9F0", color: "#29231F", textAlign: "center", padding: "6rem 1.5rem" }}>
        <h1>Something went wrong</h1>
        <p>Please try again in a moment.</p>
        <button type="button" onClick={reset} style={{ marginTop: 16, padding: "10px 20px", background: "#38251D", color: "#FFF9F0", border: 0, borderRadius: 6 }}>
          Try again
        </button>
      </body>
    </html>
  );
}
