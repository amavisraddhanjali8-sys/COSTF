import { AppUser } from '../types';

const TOKEN_KEY = 'fxtt_session_token';
const ACTIVITY_KEY = 'fxtt_last_activity';
const TIMEOUT_KEY = 'fxtt_timeout_minutes';
const USER_KEY = 'fxtt_current_user';

export function getStoredSessionToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredTimeoutMinutes(): number {
  try {
    const val = localStorage.getItem(TIMEOUT_KEY);
    if (val) {
      const num = parseInt(val, 10);
      if (!isNaN(num) && num > 0) return num;
    }
  } catch {}
  return 30; // default 30 minutes
}

export function setStoredTimeoutMinutes(minutes: number): void {
  try {
    localStorage.setItem(TIMEOUT_KEY, String(minutes));
    window.dispatchEvent(new CustomEvent('fxtt_session_timeout_changed', { detail: { minutes } }));
  } catch {}
}

export function getStoredLastActivity(): number {
  try {
    const val = localStorage.getItem(ACTIVITY_KEY);
    if (val) {
      const num = parseInt(val, 10);
      if (!isNaN(num) && num > 0) return num;
    }
  } catch {}
  return Date.now();
}

export function updateStoredLastActivity(): void {
  try {
    localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
  } catch {}
}

export function getSessionRemainingSeconds(): number {
  const token = getStoredSessionToken();
  if (!token) return 0;
  const lastAct = getStoredLastActivity();
  const timeoutMs = getStoredTimeoutMinutes() * 60 * 1000;
  const elapsed = Date.now() - lastAct;
  return Math.max(0, Math.floor((timeoutMs - elapsed) / 1000));
}

export function extendSession(): void {
  updateStoredLastActivity();
  const token = getStoredSessionToken();
  if (token) {
    fetch('/api/auth/touch-session', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    }).catch(() => {});
  }
  window.dispatchEvent(new CustomEvent('fxtt_session_extended'));
}

export function saveSession(token: string, user: AppUser, timeoutMinutes: number = 30): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
    localStorage.setItem(TIMEOUT_KEY, String(timeoutMinutes));
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    window.dispatchEvent(new CustomEvent('fxtt_session_saved', { detail: { user } }));
  } catch (e) {
    console.error('Failed to save session:', e);
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ACTIVITY_KEY);
    localStorage.removeItem(USER_KEY);
    window.dispatchEvent(new CustomEvent('fxtt_session_cleared'));
  } catch {}
}

/**
 * Check if current session is active without waiting for server response
 * Used on page reload so user does NOT get logged out prematurely
 */
export function isLocalSessionActive(): boolean {
  const token = getStoredSessionToken();
  if (!token) return false;

  const lastActivity = getStoredLastActivity();
  const timeoutMs = getStoredTimeoutMinutes() * 60 * 1000;
  const elapsed = Date.now() - lastActivity;

  return elapsed < timeoutMs;
}

/**
 * Validates session token with the server
 */
export async function verifyServerSession(): Promise<{
  valid: boolean;
  user?: AppUser;
  timeoutMinutes?: number;
}> {
  const token = getStoredSessionToken();
  if (!token) return { valid: false };

  // Check local activity timestamp first
  const lastActivity = getStoredLastActivity();
  const timeoutMs = getStoredTimeoutMinutes() * 60 * 1000;
  if (Date.now() - lastActivity > timeoutMs) {
    clearSession();
    return { valid: false };
  }

  try {
    const res = await fetch('/api/auth/session', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (res.ok) {
      const data = await res.json();
      if (data.valid && data.user) {
        updateStoredLastActivity();
        if (data.sessionTimeoutMinutes) {
          setStoredTimeoutMinutes(data.sessionTimeoutMinutes);
        }
        return {
          valid: true,
          user: data.user,
          timeoutMinutes: data.sessionTimeoutMinutes || 30
        };
      }
    }
  } catch (err) {
    console.warn('Network check failed, falling back to local session state:', err);
    // If network error during verification, rely on valid local session timestamp
    if (isLocalSessionActive()) {
      try {
        const cachedUser = localStorage.getItem(USER_KEY);
        if (cachedUser) {
          return { valid: true, user: JSON.parse(cachedUser), timeoutMinutes: getStoredTimeoutMinutes() };
        }
      } catch {}
    }
  }

  clearSession();
  return { valid: false };
}

export interface SessionActivityTrackerOptions {
  onInactivityLogout: () => void;
  onWarning?: (secondsRemaining: number) => void;
  onTick?: (secondsRemaining: number) => void;
  warningThresholdSeconds?: number;
}

/**
 * Global Inactivity Tracker
 * Tracks user activity and triggers auto-logout if no activity for configured minutes
 */
export function initSessionActivityTracker(
  optionsOrLogout: (() => void) | SessionActivityTrackerOptions
): () => void {
  const options: SessionActivityTrackerOptions =
    typeof optionsOrLogout === 'function'
      ? { onInactivityLogout: optionsOrLogout }
      : optionsOrLogout;

  const warningSec = options.warningThresholdSeconds ?? 60;
  let lastTouchServerTime = 0;
  let lastActivityRecordTime = Date.now();
  let hasTriggeredLogout = false;

  const handleUserActivity = () => {
    if (hasTriggeredLogout) return;
    const now = Date.now();
    // Throttle local activity updates to once every 1.5 seconds
    if (now - lastActivityRecordTime > 1500) {
      lastActivityRecordTime = now;
      updateStoredLastActivity();
      const remaining = getSessionRemainingSeconds();
      options.onTick?.(remaining);
    }

    // Ping server keep-alive at most once every 45 seconds
    if (now - lastTouchServerTime > 45000) {
      lastTouchServerTime = now;
      const token = getStoredSessionToken();
      if (token) {
        fetch('/api/auth/touch-session', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => {});
      }
    }
  };

  const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
  activityEvents.forEach((ev) => window.addEventListener(ev, handleUserActivity, { passive: true }));

  const checkInactivity = () => {
    if (hasTriggeredLogout) return;
    const token = getStoredSessionToken();
    if (!token) return;

    const remaining = getSessionRemainingSeconds();
    options.onTick?.(remaining);

    if (remaining <= 0) {
      hasTriggeredLogout = true;
      console.warn('Session inactivity timeout expired. Automatically signing out account.');
      clearSession();
      options.onInactivityLogout();
      return;
    }

    if (remaining <= warningSec && remaining > 0) {
      options.onWarning?.(remaining);
    }
  };

  // Check for inactivity expiration every 1 second for precision
  const intervalId = setInterval(checkInactivity, 1000);

  // Immediate check when tab becomes visible or gains focus (handles computer wake/sleep)
  const handleVisibilityOrFocus = () => {
    checkInactivity();
  };

  window.addEventListener('visibilitychange', handleVisibilityOrFocus);
  window.addEventListener('focus', handleVisibilityOrFocus);

  return () => {
    clearInterval(intervalId);
    activityEvents.forEach((ev) => window.removeEventListener(ev, handleUserActivity));
    window.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    window.removeEventListener('focus', handleVisibilityOrFocus);
  };
}
