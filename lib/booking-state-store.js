const STORAGE_KEY = "dynamic-roadbook-booking-status-v1";

function isBrowser() {
  return typeof window !== "undefined";
}

export function loadBookingState() {
  if (!isBrowser()) return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveBookingState(state) {
  if (!isBrowser()) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore local persistence failures.
  }
}
