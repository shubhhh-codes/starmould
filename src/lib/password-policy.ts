export function isValidPassword(value: unknown): value is string {
  return typeof value === "string" && Array.from(value).length >= 12 && Buffer.byteLength(value, "utf8") <= 72;
}

export const PASSWORD_POLICY_MESSAGE = "Password must contain at least 12 characters and at most 72 UTF-8 bytes";
