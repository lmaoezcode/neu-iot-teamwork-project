import { describe, expect, it } from 'vitest';
import { historySegments, historyWindow } from './history';
import type { HistoryPoint } from '../types';

function point(minute: number, value: number | null, coverageQuality: HistoryPoint['coverageQuality'] = 'complete'): HistoryPoint {
  const bucketStartUtc = new Date(Date.UTC(2026, 8, 28, 0, minute)).toISOString();
  return { bucketStartUtc, value, minimum: value, maximum: value, sampleCount: value === null ? 0 : 1, coverageQuality };
}

describe('historySegments', () => {
  it('sắp xếp điểm và giữ một đoạn khi dữ liệu liên tục', () => {
    const segments = historySegments([point(2, 30), point(0, 10), point(1, 20)]);
    expect(segments).toHaveLength(1);
    expect(segments[0]?.map((item) => item.value)).toEqual([10, 20, 30]);
  });

  it('tách đường biểu diễn khi thời gian có khoảng trống lớn', () => {
    const segments = historySegments([point(0, 10), point(1, 20), point(5, 30)]);
    expect(segments.map((segment) => segment.length)).toEqual([2, 1]);
  });

  it('không nối qua mẫu rỗng hoặc không hợp lệ', () => {
    const segments = historySegments([point(0, 10), point(1, null), point(2, 20, 'invalid'), point(3, 30)]);
    expect(segments.map((segment) => segment.map((item) => item.value))).toEqual([[10], [30]]);
  });
});

describe('historyWindow', () => {
  it('tạo đúng cửa sổ 7 ngày theo UTC', () => {
    const now = new Date('2026-09-28T12:00:00.000Z');
    expect(historyWindow(7, now)).toEqual({
      from: '2026-09-21T12:00:00.000Z',
      to: '2026-09-28T12:00:00.000Z'
    });
  });
});
