# GST invoices, returns and stock alerts

## GST invoices

**Setup:** Admin → Settings → Business & GST.
- **If you are GST-registered,** tick *GST registered* and enter your registered name, GSTIN, state and address. Then set the **HSN code and GST rate on every product** (Admin → Products → Tax). An invoice will not be issued while any product in the order is missing these. The app never guesses tax data.
- **If you are not registered,** leave it unticked. Customers get a **Bill of Supply** without tax.

**When invoices are issued:** automatically when an order is packed for dispatch, either by Shiprocket booking or by a shipment status of shipped or later. Customers and staff can also open the invoice from the order page once it is packed. Customers can print it or save it as PDF.

**Numbering:** `PREFIX/YYYY/NNNNN`, for example `BS/2627/00001`.
- The sequence is gap-free and restarts each Indian financial year (April to March).
- It is assigned inside the database, so two invoices can never get the same number.
- Issued invoices cannot be edited or deleted.

**How tax is worked out.** Prices are treated as GST-inclusive.
- Each line's taxable value is `price × 100 / (100 + rate)`.
- Coupon discounts are spread across items in proportion to their value.
- Shipping and COD charges are taxed at the rate of the main (highest-value) item, as a composite supply.
- Same state as you: CGST + SGST. A different state: IGST.

**Ask your accountant to confirm** your HSN codes, rates and the composite-supply treatment of shipping.

**Not included:**
- credit notes for refunds or returns after an invoice is issued (issue them from your accounting software)
- e-invoicing (IRN/QR), which applies only above the turnover threshold
- e-way bills

## Returns

**Setup:** Admin → Settings → Returns. Turn it on, then set the window (days after delivery) and the policy note shown to customers. The default policy suits food: only damaged, wrong, missing or unfit items are accepted.

**Customer side:** on a delivered order, *Report a problem / return* lets the customer choose the items and quantities, a reason, and a description. Only one open request is allowed per order. The database checks ownership, delivery, the window and the quantities.

**Staff side:** Admin → Returns lists open requests, oldest first. On the order page, staff can:
- **Approve** or **Reject** a request (rejecting needs a message);
- then mark it **Received** (if the item came back) or **Refunded**;
- or **Close** it.

The customer is emailed at each step.

**Refunds are separate:**
- Online payments: use the Refund panel (Razorpay).
- COD orders: refund by bank transfer.

Use *Return restock* only for items that are fit to sell again.

## Back-in-stock alerts

When a pack size is sold out, signed-in customers see **Notify me when available**. The email address comes from their account, never from a form field. The maintenance job (`/api/cron/maintenance`) emails everyone waiting once the pack can be bought again, and marks each alert as sent only after the email provider accepts it. Without an email provider, alerts wait until one is configured.
