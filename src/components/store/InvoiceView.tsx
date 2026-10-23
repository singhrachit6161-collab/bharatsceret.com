import type { InvoiceRecord } from "@/lib/data/invoices";
import { amountInWords } from "@/lib/invoice";
import { formatINR } from "@/lib/money";

const date = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

/** Printable GST tax invoice / bill of supply. Wrapped in #invoice-print so only it prints. */
export function InvoiceView({ invoice }: { invoice: InvoiceRecord }) {
  const tax = invoice.document_type === "tax_invoice";
  const { seller, buyer } = invoice;
  return (
    <article id="invoice-print" className="mx-auto max-w-4xl border border-line bg-white p-6 text-[13px] leading-relaxed text-ink sm:p-10">
      <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-walnut pb-5">
        <div>
          <p className="font-display text-3xl font-semibold text-walnut">{seller.name}</p>
          {seller.legal_name !== seller.name && <p className="font-semibold">{seller.legal_name}</p>}
          {seller.address && <p className="max-w-xs whitespace-pre-line text-muted">{seller.address}</p>}
          {seller.gstin && <p className="mt-1"><span className="font-semibold">GSTIN:</span> {seller.gstin}</p>}
          {seller.state && <p><span className="font-semibold">State:</span> {seller.state}{seller.state_code ? ` (${seller.state_code})` : ""}</p>}
        </div>
        <div className="text-right">
          <p className="text-xl font-bold tracking-wide text-walnut uppercase">{tax ? "Tax Invoice" : "Bill of Supply"}</p>
          <p className="mt-2"><span className="font-semibold">Invoice no.:</span> {invoice.invoice_number}</p>
          <p><span className="font-semibold">Invoice date:</span> {date(invoice.issued_at)}</p>
          <p><span className="font-semibold">Order no.:</span> {buyer.order_number}</p>
          <p><span className="font-semibold">Order date:</span> {date(buyer.order_date)}</p>
          <p><span className="font-semibold">Payment:</span> {buyer.payment_method}</p>
        </div>
      </header>

      <section className="grid gap-4 border-b border-line py-5 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.18em] text-muted uppercase">Billed & shipped to</p>
          <p className="mt-1 font-semibold">{buyer.name}</p>
          <p>{buyer.address}</p>
          <p>Phone: {buyer.phone}{buyer.email ? ` · ${buyer.email}` : ""}</p>
        </div>
        <div className="sm:text-right">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-muted uppercase">Place of supply</p>
          <p className="mt-1 font-semibold">{invoice.place_of_supply}</p>
          {tax && <p className="text-muted">{invoice.intra_state ? "Intra-state supply (CGST + SGST)" : "Inter-state supply (IGST)"}</p>}
        </div>
      </section>

      <div className="overflow-x-auto py-5">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="border-b-2 border-walnut text-[11px] tracking-wider uppercase">
              <th className="py-2 pr-2">#</th>
              <th className="py-2 pr-2">Description</th>
              {tax && <th className="py-2 pr-2">HSN</th>}
              <th className="py-2 pr-2 text-right">Qty</th>
              <th className="py-2 pr-2 text-right">Amount</th>
              <th className="py-2 pr-2 text-right">Discount</th>
              <th className="py-2 pr-2 text-right">{tax ? "Taxable value" : "Net"}</th>
              {tax && <th className="py-2 pr-2 text-right">GST</th>}
              {tax && invoice.intra_state && <th className="py-2 pr-2 text-right">CGST</th>}
              {tax && invoice.intra_state && <th className="py-2 pr-2 text-right">SGST</th>}
              {tax && !invoice.intra_state && <th className="py-2 pr-2 text-right">IGST</th>}
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((l, i) => (
              <tr key={i} className="border-b border-line align-top">
                <td className="py-2 pr-2">{i + 1}</td>
                <td className="py-2 pr-2">{l.description}{l.sku && <span className="block text-[11px] text-muted">SKU {l.sku}</span>}</td>
                {tax && <td className="py-2 pr-2">{l.hsn}</td>}
                <td className="py-2 pr-2 text-right">{l.quantity}</td>
                <td className="py-2 pr-2 text-right">{formatINR(l.gross_paise)}</td>
                <td className="py-2 pr-2 text-right">{l.discount_paise ? `−${formatINR(l.discount_paise)}` : "—"}</td>
                <td className="py-2 pr-2 text-right">{formatINR(l.taxable_paise)}</td>
                {tax && <td className="py-2 pr-2 text-right">{l.rate}%</td>}
                {tax && invoice.intra_state && <td className="py-2 pr-2 text-right">{formatINR(l.cgst_paise)}</td>}
                {tax && invoice.intra_state && <td className="py-2 pr-2 text-right">{formatINR(l.sgst_paise)}</td>}
                {tax && !invoice.intra_state && <td className="py-2 pr-2 text-right">{formatINR(l.igst_paise)}</td>}
                <td className="py-2 text-right font-semibold">{formatINR(l.total_paise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="flex flex-wrap justify-between gap-6">
        <p className="max-w-sm self-end text-muted"><span className="font-semibold text-ink">Amount in words:</span> {amountInWords(invoice.total_paise)}</p>
        <dl className="w-full max-w-xs space-y-1">
          <div className="flex justify-between"><dt>{tax ? "Taxable value" : "Net amount"}</dt><dd>{formatINR(invoice.taxable_paise)}</dd></div>
          {tax && invoice.intra_state && <div className="flex justify-between"><dt>CGST</dt><dd>{formatINR(invoice.cgst_paise)}</dd></div>}
          {tax && invoice.intra_state && <div className="flex justify-between"><dt>SGST</dt><dd>{formatINR(invoice.sgst_paise)}</dd></div>}
          {tax && !invoice.intra_state && <div className="flex justify-between"><dt>IGST</dt><dd>{formatINR(invoice.igst_paise)}</dd></div>}
          <div className="flex justify-between border-t-2 border-walnut pt-2 text-base font-bold"><dt>Invoice total</dt><dd>{formatINR(invoice.total_paise)}</dd></div>
        </dl>
      </section>

      <footer className="mt-8 border-t border-line pt-4 text-[11px] text-muted">
        {tax ? <p>Prices are inclusive of GST. Tax is not payable under reverse charge.</p> : <p>Supplier not registered under GST; no tax is charged on this bill of supply.</p>}
        <p>This is a computer-generated document and does not require a signature.</p>
      </footer>
    </article>
  );
}
