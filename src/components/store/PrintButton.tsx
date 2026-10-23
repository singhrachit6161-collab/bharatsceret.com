"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Print / save as PDF" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn-primary inline-flex items-center gap-2">
      <Printer size={16} aria-hidden="true" /> {label}
    </button>
  );
}
