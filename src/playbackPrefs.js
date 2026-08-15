export const SLEEP_OPTIONS = [15, 30, 45, 60];

export function sleepDeadline(minutes) {
  return Date.now() + minutes * 60 * 1000;
}
