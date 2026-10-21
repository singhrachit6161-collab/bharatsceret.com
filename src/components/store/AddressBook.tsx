"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteAddress, setDefaultAddress } from "@/app/actions/account";
import type { Address } from "@/lib/types";
import { AddressForm } from "./AddressForm";

export function AddressBook({ addresses }: { addresses: Address[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(addresses.length ? null : "new");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const done = () => {
    setEditing(null);
    router.refresh();
  };
  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      <ul className="grid gap-4 sm:grid-cols-2">
        {addresses.map((a) =>
          editing === a.id ? (
            <li key={a.id} className="card p-4 sm:col-span-2">
              <AddressForm address={a} onSaved={done} onCancel={() => setEditing(null)} />
            </li>
          ) : (
            <li key={a.id} className="card p-4 text-sm">
              <p className="font-semibold">
                {a.full_name} {a.is_default && <span className="ml-2 rounded bg-almond-100 px-2 py-0.5 text-xs text-walnut">Default</span>}
              </p>
              <p className="mt-1">{a.line1}{a.line2 ? `, ${a.line2}` : ""}</p>
              {a.landmark && <p>Near {a.landmark}</p>}
              <p>{a.city}, {a.state} – {a.pincode}</p>
              <p className="text-muted">{a.phone}</p>
              <div className="mt-3 flex gap-3 text-xs font-semibold">
                <button type="button" onClick={() => setEditing(a.id)} className="text-walnut hover:underline">Edit</button>
                {!a.is_default && (
                  <button type="button" disabled={pending} onClick={() => start(async () => { const r = await setDefaultAddress(a.id); if (!r.ok) setError(r.error); router.refresh(); })} className="text-walnut hover:underline">
                    Set as default
                  </button>
                )}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm("Delete this address?")) return;
                    start(async () => { const r = await deleteAddress(a.id); if (!r.ok) setError(r.error); router.refresh(); });
                  }}
                  className="text-danger hover:underline"
                >
                  Delete
                </button>
              </div>
            </li>
          ),
        )}
      </ul>
      {editing === "new" ? (
        <div className="card p-4">
          <AddressForm onSaved={done} onCancel={addresses.length ? () => setEditing(null) : undefined} />
        </div>
      ) : (
        <button type="button" onClick={() => setEditing("new")} className="btn-outline">Add a new address</button>
      )}
    </div>
  );
}
