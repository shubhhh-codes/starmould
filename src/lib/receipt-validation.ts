/** Reject invalid identities and aggregate repeated plates before checking a source balance. */
export function aggregateReceiptItems(items: unknown): Map<number, number> {
  if (!Array.isArray(items) || !items.length || items.length > 500) throw new Error("Receipt requires 1 to 500 lines");
  const quantities = new Map<number, number>();
  for (const item of items) {
    const plate = Number(item?.plateid);
    const qty = Number(item?.inward_qty);
    if (!Number.isSafeInteger(plate) || plate <= 0 || !Number.isSafeInteger(qty) || qty <= 0) throw new Error("Receipt plate and quantity must be positive integers");
    const total = (quantities.get(plate) || 0) + qty;
    if (!Number.isSafeInteger(total)) throw new Error("Receipt quantity exceeds supported range");
    quantities.set(plate, total);
  }
  return quantities;
}
