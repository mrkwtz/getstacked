import { describe, it, expect } from 'vitest';
import {
  computeEffectiveElapsedMs,
  computeCurrentLevelIndex,
  computeRemainingMs,
  computePlaytimeMs,
  computeTimeUntilNextBreakMs,
  isTimerPaused,
  startTimer,
  pauseTimer,
  resumeTimer,
  skipLevel,
} from '$lib/timer';
import type { BlindLevel, TimerState } from '$lib/types';

const t0 = new Date('2026-01-01T12:00:00.000Z');
const t5m = new Date('2026-01-01T12:05:00.000Z');
const t20m = new Date('2026-01-01T12:20:00.000Z');
const t25m = new Date('2026-01-01T12:25:00.000Z');
const t45m = new Date('2026-01-01T12:45:00.000Z');

function makeState(overrides: Partial<TimerState> = {}): TimerState {
  return {
    started_at: t0.toISOString(),
    pauses: [],
    skip_ms: 0,
    ...overrides,
  };
}

const levels: BlindLevel[] = [
  { duration_minutes: 20, small_blind: 25, big_blind: 50, ante: 0 },
  { duration_minutes: 20, small_blind: 50, big_blind: 100, ante: 0 },
  { type: 'break', duration_minutes: 15, small_blind: 0, big_blind: 0, ante: 0, label: 'Dinner' },
  { duration_minutes: 20, small_blind: 75, big_blind: 150, ante: 25 },
];

describe('computeEffectiveElapsedMs', () => {
  it('returns 0 at start', () => {
    expect(computeEffectiveElapsedMs(makeState(), t0)).toBe(0);
  });

  it('returns elapsed ms with no pauses', () => {
    expect(computeEffectiveElapsedMs(makeState(), t5m)).toBe(5 * 60_000);
  });

  it('subtracts completed pause duration', () => {
    const state = makeState({
      pauses: [{ paused_at: t5m.toISOString(), resumed_at: new Date('2026-01-01T12:08:00.000Z').toISOString() }],
    });
    const now = new Date('2026-01-01T12:20:00.000Z');
    expect(computeEffectiveElapsedMs(state, now)).toBe(17 * 60_000);
  });

  it('subtracts ongoing pause duration when currently paused', () => {
    const state = makeState({
      pauses: [{ paused_at: t5m.toISOString(), resumed_at: null }],
    });
    expect(computeEffectiveElapsedMs(state, t20m)).toBe(5 * 60_000);
  });

  it('adds skip_ms to effective elapsed', () => {
    const state = makeState({ skip_ms: 3 * 60_000 });
    expect(computeEffectiveElapsedMs(state, t5m)).toBe(8 * 60_000);
  });
});

describe('computeCurrentLevelIndex', () => {
  it('returns 0 at start', () => {
    expect(computeCurrentLevelIndex(makeState(), levels, t0)).toBe(0);
  });

  it('returns 0 at 5 minutes (within first 20-min level)', () => {
    expect(computeCurrentLevelIndex(makeState(), levels, t5m)).toBe(0);
  });

  it('returns 1 at exactly 20 minutes (start of second level)', () => {
    expect(computeCurrentLevelIndex(makeState(), levels, t20m)).toBe(1);
  });

  it('returns 2 at 40 minutes (break level)', () => {
    const t40m = new Date('2026-01-01T12:40:00.000Z');
    expect(computeCurrentLevelIndex(makeState(), levels, t40m)).toBe(2);
  });

  it('returns last level index when all levels exhausted', () => {
    const t99m = new Date('2026-01-01T13:39:00.000Z');
    expect(computeCurrentLevelIndex(makeState(), levels, t99m)).toBe(levels.length - 1);
  });
});

describe('computeRemainingMs', () => {
  it('returns full level duration at start', () => {
    expect(computeRemainingMs(makeState(), levels, t0)).toBe(20 * 60_000);
  });

  it('returns remaining time mid-level', () => {
    expect(computeRemainingMs(makeState(), levels, t5m)).toBe(15 * 60_000);
  });

  it('returns 0 when all levels exhausted', () => {
    const t99m = new Date('2026-01-01T13:39:00.000Z');
    expect(computeRemainingMs(makeState(), levels, t99m)).toBe(0);
  });

  it('accounts for pauses in remaining time', () => {
    const t8m = new Date('2026-01-01T12:08:00.000Z');
    const state = makeState({
      pauses: [{ paused_at: t5m.toISOString(), resumed_at: t8m.toISOString() }],
    });
    expect(computeRemainingMs(state, levels, t20m)).toBe(3 * 60_000);
  });
});

describe('computePlaytimeMs', () => {
  it('returns wall-clock time including pauses', () => {
    const state = makeState({
      pauses: [{ paused_at: t5m.toISOString(), resumed_at: t20m.toISOString() }],
    });
    expect(computePlaytimeMs(state, t20m)).toBe(20 * 60_000);
  });
});

describe('computeTimeUntilNextBreakMs', () => {
  it('returns null when no break ahead', () => {
    const noBreakLevels: BlindLevel[] = [
      { duration_minutes: 20, small_blind: 25, big_blind: 50, ante: 0 },
      { duration_minutes: 20, small_blind: 50, big_blind: 100, ante: 0 },
    ];
    expect(computeTimeUntilNextBreakMs(makeState(), noBreakLevels, t0)).toBeNull();
  });

  it('returns time until next break from level 1 (two levels away)', () => {
    expect(computeTimeUntilNextBreakMs(makeState(), levels, t0)).toBe(40 * 60_000);
  });

  it('returns time until next break from level 2', () => {
    expect(computeTimeUntilNextBreakMs(makeState(), levels, t25m)).toBe(15 * 60_000);
  });

  it('returns null when currently in a break level', () => {
    expect(computeTimeUntilNextBreakMs(makeState(), levels, t45m)).toBeNull();
  });
});

describe('isTimerPaused', () => {
  it('returns false when no pauses', () => {
    expect(isTimerPaused(makeState())).toBe(false);
  });

  it('returns false when last pause has a resumed_at', () => {
    const state = makeState({
      pauses: [{ paused_at: t5m.toISOString(), resumed_at: t20m.toISOString() }],
    });
    expect(isTimerPaused(state)).toBe(false);
  });

  it('returns true when last pause has no resumed_at', () => {
    const state = makeState({
      pauses: [{ paused_at: t5m.toISOString(), resumed_at: null }],
    });
    expect(isTimerPaused(state)).toBe(true);
  });
});

describe('startTimer', () => {
  it('sets started_at to now ISO string', () => {
    const state = startTimer(t0);
    expect(state.started_at).toBe(t0.toISOString());
  });

  it('initialises pauses as empty array', () => {
    expect(startTimer(t0).pauses).toEqual([]);
  });

  it('initialises skip_ms as 0', () => {
    expect(startTimer(t0).skip_ms).toBe(0);
  });
});

describe('pauseTimer', () => {
  it('appends a pause entry with paused_at and null resumed_at', () => {
    const state = pauseTimer(makeState(), t5m);
    expect(state.pauses).toEqual([{ paused_at: t5m.toISOString(), resumed_at: null }]);
  });

  it('returns same state when already paused', () => {
    const state = makeState({ pauses: [{ paused_at: t5m.toISOString(), resumed_at: null }] });
    expect(pauseTimer(state, t20m)).toBe(state);
  });
});

describe('resumeTimer', () => {
  it('sets resumed_at on the last pause entry', () => {
    const state = makeState({ pauses: [{ paused_at: t5m.toISOString(), resumed_at: null }] });
    const resumed = resumeTimer(state, t20m);
    expect(resumed.pauses[0].resumed_at).toBe(t20m.toISOString());
  });

  it('returns same state when not paused', () => {
    const state = makeState();
    expect(resumeTimer(state, t5m)).toBe(state);
  });
});

describe('skipLevel', () => {
  it('adds remaining time of current level to skip_ms', () => {
    const result = skipLevel(makeState(), levels, t5m);
    expect(result.skip_ms).toBe(15 * 60_000);
  });

  it('accumulates skip_ms across multiple skips', () => {
    const afterFirst = skipLevel(makeState(), levels, t5m);
    const afterSecond = skipLevel(afterFirst, levels, t5m);
    expect(afterSecond.skip_ms).toBe(15 * 60_000 + 20 * 60_000);
  });
});
