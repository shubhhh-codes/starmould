export const formatTimestamp = (ts: string | null | undefined): string => {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return String(ts);
  }
};
