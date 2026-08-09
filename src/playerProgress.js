export function bubbleSecondsFromPointer(clientX, trackLeft, trackWidth, durationSeconds) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || !Number.isFinite(trackWidth) || trackWidth <= 0) return 0;
  const ratio = (clientX - trackLeft) / trackWidth;
  return Math.min(Math.max(Math.round(ratio * durationSeconds), 0), durationSeconds);
}
