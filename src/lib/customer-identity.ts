export function normalizeCustomerInitials(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, "").toUpperCase() : "";
}

export function isValidCustomerInitials(value: string): boolean {
  return /^[A-Z]{1,5}$/.test(value);
}

// Alphabetic suffixes keep imported initials within the same rules as the forms.
export function generateCustomerInitials(name: string, used: Set<string>): string {
  const words = name.toUpperCase().match(/[A-Z]+/g) || [];
  const base = (words.length > 1 ? words.map((word) => word[0]).join("") : words[0] || "CUST").slice(0, 5);
  if (!used.has(base)) return base;
  for (let i = 0; i < 26 ** 4; i++) {
    let number = i;
    let suffix = "";
    do {
      suffix = String.fromCharCode(65 + number % 26) + suffix;
      number = Math.floor(number / 26) - 1;
    } while (number >= 0);
    const candidate = base.slice(0, 5 - suffix.length) + suffix;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error("No available customer initials. Enter initials manually.");
}

export function customerCodeChanged(
  body: { customer_code?: unknown; pan_code?: unknown },
  current: { customer_code?: string | null; pan_code?: string | null },
): boolean {
  const normalize = (value: unknown) => typeof value === "string" ? value.trim().toUpperCase() : "";
  const existing = normalize(current.customer_code || current.pan_code);
  return ["customer_code", "pan_code"].some((key) => {
    const value = body[key as keyof typeof body];
    return value !== undefined && (typeof value !== "string" || normalize(value) !== existing);
  });
}
