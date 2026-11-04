export function normalizeQuotationItems(value: unknown): Record<string, any>[] {
  if (!Array.isArray(value) || !value.length || value.length > 500) throw new Error("Quotation requires 1 to 500 items");
  return value.map((item) => {
    if (!item || typeof item !== "object") throw new Error("Invalid quotation item");
    const qty = Number(item.qty);
    const price = Number(item.unit_price);
    const totalPaise = Math.round(qty * price * 100);
    const name = String(item.product_name || item.product_description || "").trim();
    if (!name || !Number.isSafeInteger(qty) || qty <= 0 || !Number.isFinite(price) || price < 0 ||
        !Number.isSafeInteger(totalPaise)) throw new Error("Invalid quotation quantity, price or product name");
    if (item.total_amount !== undefined && item.total_amount !== null && item.total_amount !== "" &&
        (!Number.isFinite(Number(item.total_amount)) || Math.abs(Math.round(Number(item.total_amount) * 100) - totalPaise) > 0)) {
      throw new Error("Quotation line total does not match quantity × unit price");
    }
    return { ...item, product_name: name, qty, unit_price: price, total_amount: totalPaise / 100 };
  });
}
