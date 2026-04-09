<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import {
    computeCurrentLevelIndex,
    computeRemainingMs,
    computePlaytimeMs,
    computeTimeUntilNextBreakMs,
    isTimerPaused,
  } from '$lib/timer';
  import type { TimerState, BlindLevel } from '$lib/types';
  import * as m from '$lib/paraglide/messages';
  import type { PageData } from './$types';

  const { data }: { data: PageData } = $props();

  let now = $state(new Date());

  $effect(() => {
    const tick = setInterval(() => { now = new Date(); }, 1000);
    const poll = setInterval(() => { invalidateAll(); }, 5000);
    return () => { clearInterval(tick); clearInterval(poll); };
  });

  const t = $derived(data.tournament);
  const timerState = $derived(t.timer_state as TimerState | null);
  const blindLevels = $derived((t.blind_structures?.levels ?? []) as unknown as BlindLevel[]);

  const currentLevelIdx = $derived(
    timerState && blindLevels.length > 0
      ? computeCurrentLevelIndex(timerState, blindLevels, now)
      : 0,
  );
  const currentLevel = $derived(blindLevels[currentLevelIdx] ?? null);
  const nextLevel = $derived(blindLevels[currentLevelIdx + 1] ?? null);
  const remainingMs = $derived(
    timerState && blindLevels.length > 0
      ? computeRemainingMs(timerState, blindLevels, now)
      : 0,
  );
  const playtimeMs = $derived(timerState ? computePlaytimeMs(timerState, now) : 0);
  const nextBreakMs = $derived(
    timerState && blindLevels.length > 0
      ? computeTimeUntilNextBreakMs(timerState, blindLevels, now)
      : null,
  );
  const timerPaused = $derived(timerState ? isTimerPaused(timerState) : false);

  const levelNumber = $derived(
    currentLevelIdx + 1 - blindLevels.slice(0, currentLevelIdx).filter((l) => l.type === 'break').length,
  );

  const levelProgress = $derived(
    currentLevel ? 1 - remainingMs / (currentLevel.duration_minutes * 60_000) : 0,
  );

  function formatTime(ms: number): string {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function formatPlaytime(ms: number): string {
    const totalMinutes = Math.floor(ms / 60_000);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hours > 0) return `${hours}h ${String(mins).padStart(2, '0')}m`;
    return `${mins}m`;
  }

  function formatWallTime(date: Date): string {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  function formatMoney(cents: number): string {
    return `€${(cents / 100).toFixed(0)}`;
  }

  function formatStack(chips: number | null): string {
    if (chips === null) return '—';
    if (chips >= 1000) return `${(chips / 1000).toFixed(1).replace(/\.0$/, '')}k`;
    return String(chips);
  }

  const isBreak = $derived(currentLevel?.type === 'break');
  const levelLabel = $derived(
    isBreak
      ? (currentLevel?.label || m.timer_break())
      : `${m.timer_level()} ${levelNumber}`,
  );
</script>

<svelte:head>
  <title>{t.name} · Clock</title>
</svelte:head>

<div class="min-h-screen bg-[#0a0a0a] text-white flex flex-col p-6 font-sans select-none">
  <!-- Top bar -->
  <div class="flex justify-between items-center mb-auto">
    <span class="text-xs text-zinc-600 uppercase tracking-widest">{t.name}</span>
    <span class="text-xs text-zinc-600">
      {formatWallTime(now)}
      {#if timerState}
        &nbsp;·&nbsp; {m.clock_playing()} {formatPlaytime(playtimeMs)}
      {/if}
      {#if timerPaused}
        &nbsp;·&nbsp; <span class="text-accent">⏸</span>
      {/if}
    </span>
  </div>

  <!-- Center -->
  <div class="flex-1 flex flex-col items-center justify-center gap-6">
    {#if t.status === 'finished'}
      <div class="text-xs text-zinc-500 uppercase tracking-[0.3em]">Tournament</div>
      <div class="text-[min(16vw,6rem)] font-bold font-mono leading-none tracking-widest text-zinc-600">
        OVER
      </div>
      <div class="w-64 bg-zinc-800 rounded-full h-1">
        <div class="bg-zinc-600 h-1 rounded-full w-full"></div>
      </div>
    {:else}
      <div class="text-xs text-zinc-500 uppercase tracking-[0.3em]">{levelLabel}</div>

      <div class="text-[min(20vw,8rem)] font-bold font-mono leading-none tracking-widest {remainingMs === 0 ? 'text-accent' : timerPaused ? 'text-zinc-500' : 'text-white'}">
        {formatTime(remainingMs)}
      </div>

      <!-- Progress bar -->
      <div class="w-64 bg-zinc-800 rounded-full h-1">
        <div
          class="bg-accent h-1 rounded-full transition-all duration-1000"
          style="width: {Math.min(100, Math.round(levelProgress * 100))}%"
        ></div>
      </div>

      {#if timerPaused}
        <div class="text-xs text-zinc-500 uppercase tracking-[0.3em] animate-pulse">⏸ paused</div>
      {/if}

      <!-- Blinds row -->
      {#if currentLevel && !isBreak}
        <div class="flex gap-8 mt-2">
          <div class="text-center">
            <div class="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">{m.clock_small_blind()}</div>
            <div class="text-3xl font-semibold text-zinc-200">{currentLevel.small_blind}</div>
          </div>
          <div class="text-center">
            <div class="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">{m.clock_big_blind()}</div>
            <div class="text-3xl font-semibold text-zinc-200">{currentLevel.big_blind}</div>
          </div>
          {#if currentLevel.ante > 0}
            <div class="text-center">
              <div class="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">{m.clock_ante()}</div>
              <div class="text-3xl font-semibold text-zinc-200">{currentLevel.ante}</div>
            </div>
          {/if}
          {#if nextLevel}
            <div class="text-center border-l border-zinc-800 pl-8">
              <div class="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">{m.clock_next_level()}</div>
              <div class="text-base text-zinc-500 mt-1.5">
                {nextLevel.type === 'break'
                  ? (nextLevel.label || m.timer_break())
                  : `${nextLevel.small_blind} / ${nextLevel.big_blind}`}
              </div>
            </div>
          {/if}
        </div>
      {:else if isBreak && nextLevel}
        <div class="text-center">
          <div class="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">{m.clock_next_level()}</div>
          <div class="text-base text-zinc-500">
            {nextLevel.type === 'break'
              ? (nextLevel.label || m.timer_break())
              : `${nextLevel.small_blind} / ${nextLevel.big_blind}`}
          </div>
        </div>
      {/if}
    {/if}
  </div>

  <!-- Bottom stats bar -->
  <div class="mt-auto pt-6 border-t border-zinc-900 flex justify-center gap-10">
    <div class="text-center">
      <div class="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">{m.clock_players()}</div>
      <div class="text-lg text-zinc-400">{data.playersRemaining} / {data.playersTotal}</div>
    </div>
    {#if data.averageStack !== null}
      <div class="text-center">
        <div class="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">{m.clock_avg_stack()}</div>
        <div class="text-lg text-zinc-400">{formatStack(data.averageStack)}</div>
      </div>
    {/if}
    <div class="text-center">
      <div class="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">{m.clock_prize_pool()}</div>
      <div class="text-lg text-zinc-400">{formatMoney(data.prizePool)}</div>
    </div>
    {#if nextBreakMs !== null}
      <div class="text-center">
        <div class="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">{m.clock_next_break()}</div>
        <div class="text-lg text-zinc-400">{formatTime(nextBreakMs)}</div>
      </div>
    {/if}
  </div>
</div>
