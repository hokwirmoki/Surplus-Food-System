const DEFAULT_IDLE_TIMEOUT_MINUTES = 30;

export const SESSION_EXPIRED_EVENT = "sfs-session-expired";
export const LAST_ACTIVITY_KEY = "lastActivityAt";

export function getIdleTimeoutMs() {
  const configuredMinutes = Number(import.meta.env.VITE_IDLE_LOGOUT_MINUTES);
  const minutes = Number.isFinite(configuredMinutes) && configuredMinutes > 0
    ? configuredMinutes
    : DEFAULT_IDLE_TIMEOUT_MINUTES;

  return minutes * 60 * 1000;
}

export function markSessionActivity() {
  localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
}

export function getLastSessionActivity() {
  const value = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
  return Number.isFinite(value) && value > 0 ? value : Date.now();
}

export function clearSession() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  localStorage.removeItem(LAST_ACTIVITY_KEY);
}
