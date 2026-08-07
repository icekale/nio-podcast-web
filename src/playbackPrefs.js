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
