const pad = (n) => String(n).padStart(2, "0");

// "2025-09-01 10:30" — the same format the prototype displayed.
export function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatTime(value) {
  if (!value) return "";
  const d = new Date(value);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Combines the <input type="date"> and <input type="time"> values (local time)
// into an ISO string the API understands. Returns null if invalid.
export function toIsoFromLocal(date, time) {
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Minutes left until a dispatcher/driver-reported ETA, counted from when it
// was entered. Returns null for the default estimate (it has no start time).
export function minutesRemaining(eta, now = Date.now()) {
  if (!eta?.minutes || !eta.updatedAt || eta.source === "default_estimate") return null;
  const arriveAt = new Date(eta.updatedAt).getTime() + eta.minutes * 60000;
  return Math.max(0, Math.ceil((arriveAt - now) / 60000));
}

export function findActiveBooking(bookings) {
  return (bookings || []).find((b) => b.status !== "completed") || null;
}

export function findCompletedWithoutFeedback(bookings) {
  return (bookings || []).find((b) => b.status === "completed" && !b.feedback) || null;
}
