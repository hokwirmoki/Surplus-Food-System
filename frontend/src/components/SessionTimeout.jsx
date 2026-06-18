import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  clearSession,
  getIdleTimeoutMs,
  getLastSessionActivity,
  LAST_ACTIVITY_KEY,
  markSessionActivity,
  SESSION_EXPIRED_EVENT
} from "../utils/session";

const activityEvents = [
  "click",
  "keydown",
  "mousedown",
  "mousemove",
  "scroll",
  "touchstart"
];

function SessionTimeout({ user, setUser }) {
  const navigate = useNavigate();
  const timerRef = useRef(null);
  const toastRef = useRef(null);
  const lastActivityWriteRef = useRef(0);

  useEffect(() => {
    if (!user) return undefined;

    const timeoutMs = getIdleTimeoutMs();

    const endSession = (showMessage = true) => {
      clearTimeout(timerRef.current);
      clearSession();
      setUser(null);

      if (showMessage && !toast.isActive(toastRef.current)) {
        toastRef.current = toast.info("Session expired. Please log in again.", {
          autoClose: 3000
        });
      }

      navigate("/", { replace: true });
    };

    const scheduleCheck = () => {
      clearTimeout(timerRef.current);

      const inactiveFor = Date.now() - getLastSessionActivity();
      const remainingMs = Math.max(timeoutMs - inactiveFor, 0);

      timerRef.current = setTimeout(() => {
        const latestInactiveFor = Date.now() - getLastSessionActivity();

        if (latestInactiveFor >= timeoutMs) {
          endSession(true);
          return;
        }

        scheduleCheck();
      }, remainingMs);
    };

    const recordActivity = () => {
      if (!localStorage.getItem("token")) return;

      const now = Date.now();
      if (now - getLastSessionActivity() >= timeoutMs) {
        endSession(true);
        return;
      }

      if (now - lastActivityWriteRef.current < 1000) return;

      lastActivityWriteRef.current = now;
      markSessionActivity();
      scheduleCheck();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        scheduleCheck();
      }
    };

    const handleForcedExpiry = () => endSession(false);
    const handleStorageChange = (event) => {
      if ((event.key === "token" || event.key === "user") && !localStorage.getItem("token")) {
        endSession(false);
      }
    };

    if (!localStorage.getItem(LAST_ACTIVITY_KEY)) {
      markSessionActivity();
    }

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, recordActivity, { passive: true });
    });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener(SESSION_EXPIRED_EVENT, handleForcedExpiry);
    window.addEventListener("storage", handleStorageChange);

    scheduleCheck();

    return () => {
      clearTimeout(timerRef.current);
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, recordActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleForcedExpiry);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [navigate, setUser, user]);

  return null;
}

export default SessionTimeout;
