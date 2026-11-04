import type { HistoryPoint } from '../types';

export function historySegments(points: HistoryPoint[], maximumGapMs = 150_000): HistoryPoint[][] {
  const sorted = [...points].sort((left, right) => Date.parse(left.bucketStartUtc) - Date.parse(right.bucketStartUtc));
  const segments: HistoryPoint[][] = [];
  let current: HistoryPoint[] = [];
  let previousTime: number | null = null;
  for (const point of sorted) {
    const time = Date.parse(point.bucketStartUtc);
    const usable = Number.isFinite(time) && point.value !== null && point.coverageQuality !== 'invalid';
    const gap = previousTime !== null && time - previousTime > maximumGapMs;
    if (!usable || gap) {
      if (current.length > 0) segments.push(current);
      current = [];
    }
    if (usable) {
      current.push(point);
      previousTime = time;
    } else {
      previousTime = null;
    }
  }
  if (current.length > 0) segments.push(current);
  return segments;
}

export function historyWindow(days: 1 | 7 | 30, now = new Date()): { from: string; to: string } {
  return {
    from: new Date(now.getTime() - days * 86_400_000).toISOString(),
    to: now.toISOString()
  };
}
