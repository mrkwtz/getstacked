import type { BlindLevel, TimerState } from '$lib/types';

function totalPausedMs(state: TimerState, now: Date): number {
  let total = 0;
  for (const pause of state.pauses) {
    const end = pause.resumed_at ? new Date(pause.resumed_at).getTime() : now.getTime();
    total += end - new Date(pause.paused_at).getTime();
  }
  return total;
}

export function computeEffectiveElapsedMs(state: TimerState, now: Date): number {
  const wall = now.getTime() - new Date(state.started_at).getTime();
  return Math.max(0, wall - totalPausedMs(state, now) + (state.skip_ms ?? 0));
}

export function computeCurrentLevelIndex(state: TimerState, levels: BlindLevel[], now: Date): number {
  const elapsed = computeEffectiveElapsedMs(state, now);
  let accumulated = 0;
  for (let i = 0; i < levels.length; i++) {
    accumulated += levels[i].duration_minutes * 60_000;
    if (elapsed < accumulated) return i;
  }
  return levels.length - 1;
}

export function computeRemainingMs(state: TimerState, levels: BlindLevel[], now: Date): number {
  const elapsed = computeEffectiveElapsedMs(state, now);
  let accumulated = 0;
  for (const level of levels) {
    accumulated += level.duration_minutes * 60_000;
    if (elapsed < accumulated) return accumulated - elapsed;
  }
  return 0;
}

export function computePlaytimeMs(state: TimerState, now: Date): number {
  return now.getTime() - new Date(state.started_at).getTime();
}

export function computeTimeUntilNextBreakMs(
  state: TimerState,
  levels: BlindLevel[],
  now: Date,
): number | null {
  const elapsed = computeEffectiveElapsedMs(state, now);
  let accumulated = 0;
  let currentFound = false;

  for (let i = 0; i < levels.length; i++) {
    const levelStart = accumulated;
    accumulated += levels[i].duration_minutes * 60_000;

    if (!currentFound) {
      if (elapsed < accumulated) {
        currentFound = true;
        if (levels[i].type === 'break') return null;
      }
      continue;
    }

    if (levels[i].type === 'break') return levelStart - elapsed;
  }

  return null;
}

export function isTimerPaused(state: TimerState): boolean {
  if (state.pauses.length === 0) return false;
  return state.pauses[state.pauses.length - 1].resumed_at === null;
}

export function startTimer(now: Date): TimerState {
  return { started_at: now.toISOString(), pauses: [], skip_ms: 0 };
}

export function pauseTimer(state: TimerState, now: Date): TimerState {
  if (isTimerPaused(state)) return state;
  return { ...state, pauses: [...state.pauses, { paused_at: now.toISOString(), resumed_at: null }] };
}

export function resumeTimer(state: TimerState, now: Date): TimerState {
  if (!isTimerPaused(state)) return state;
  const pauses = state.pauses.map((p, i) =>
    i === state.pauses.length - 1 ? { ...p, resumed_at: now.toISOString() } : p,
  );
  return { ...state, pauses };
}

export function skipLevel(state: TimerState, levels: BlindLevel[], now: Date): TimerState {
  const remaining = computeRemainingMs(state, levels, now);
  return { ...state, skip_ms: (state.skip_ms ?? 0) + remaining };
}
