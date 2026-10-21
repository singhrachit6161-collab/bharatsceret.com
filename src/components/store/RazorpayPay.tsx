"use client";

import { Loader2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { useState } from "react";
import { reportPaymentFailure, startPayment, verifyPayment } from "@/app/actions/checkout";
import { formatINR } from "@/lib/money";

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}
interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", cb: (r: { error: { code?: string; description?: string; metadata?: { order_id?: string; payment_id?: string } } }) => void): void;
}
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

export function RazorpayPay({ orderId, totalPaise, testMode }: { orderId: string; totalPaise: number; testMode: boolean }) {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async () => {
    setError(null);
    setBusy(true);
    const res = await startPayment(orderId);
    if (!res.ok) {
      setError(res.error);
      setBusy(false);
      return;
    }
    if (!window.Razorpay) {
      setError("Payment window could not load. Check your connection and try again.");
      setBusy(false);
      return;
    }
    const s = res.session;
    const rzp = new window.Razorpay({
      key: s.keyId,
      amount: s.amountPaise,
      currency: s.currency,
      order_id: s.providerOrderId,
      name: "Bharat Secret",
      description: `Order ${s.orderNumber}`,
      prefill: s.prefill,
      theme: { color: "#38251D" },
      modal: {
        ondismiss: () => setBusy(false),
        confirm_close: true,
      },
      handler: async (response: RazorpayResponse) => {
        const v = await verifyPayment(response);
        if (v.ok) router.replace(`/checkout/result/${orderId}`);
        else {
          setError(v.error);
          setBusy(false);
        }
      },
    });
    rzp.on("payment.failed", (r) => {
      void reportPaymentFailure({
        orderId,
        providerOrderId: r.error.metadata?.order_id ?? s.providerOrderId,
        paymentId: r.error.metadata?.payment_id,
        code: r.error.code,
        description: r.error.description,
      });
      setError(`Payment failed${r.error.description ? `: ${r.error.description}` : ""}. You can try again.`);
    });
    rzp.open();
  };

  return (
    <div className="space-y-3">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" onLoad={() => setLoaded(true)} onReady={() => setLoaded(true)} />
      {testMode && (
        <p className="rounded-md border border-danger/30 bg-danger/5 p-3 text-xs text-danger">
          Razorpay TEST MODE: use Razorpay test cards/UPI IDs. No real money will be charged.
        </p>
      )}
      <button type="button" onClick={pay} disabled={!loaded || busy} className="btn-primary w-full py-3">
        {busy ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}
        {busy ? "Processing…" : `Pay ${formatINR(totalPaise)} securely`}
      </button>
      {error && <p className="rounded-md bg-danger/10 p-3 text-sm text-danger" role="alert">{error}</p>}
    </div>
  );
}
