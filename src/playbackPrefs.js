export const PLAYBACK_RATE_KEY = 'nio_playback_rate_v1';

export const SPEED_OPTIONS = [1, 1.2, 1.5, 2];

export function cycleRate(current) {
  const index = SPEED_OPTIONS.indexOf(current);
  return SPEED_OPTIONS[(index + 1) % SPEED_OPTIONS.length] ?? SPEED_OPTIONS[0];
}

export function formatRate(rate) {
  const value = Number(rate) || 1;
  return `${value % 1 === 0 ? String(value) : value.toFixed(1)}×`;
}

export function readPlaybackRate() {
  try {
    const value = Number(window.localStorage.getItem(PLAYBACK_RATE_KEY));
    return SPEED_OPTIONS.includes(value) ? value : 1;
  } catch {
    return 1;
  }
}

export function writePlaybackRate(rate) {
  try {
    window.localStorage.setItem(PLAYBACK_RATE_KEY, String(rate));
  } catch {
    /* optional persistence */
  }
}

export const SLEEP_OPTIONS = [15, 30, 45, 60];

export function sleepDeadline(minutes) {
  return Date.now() + minutes * 60 * 1000;
}

export function formatSleepRemaining(deadline) {
  const remaining = Math.max(0, deadline - Date.now());
  const minutes = Math.ceil(remaining / 60000);
  if (minutes >= 60) return `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分`;
  return `${minutes} 分钟`;
}
