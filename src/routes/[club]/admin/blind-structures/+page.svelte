<script lang="ts">
  import { createClient } from '$lib/supabase';
  import { invalidateAll } from '$app/navigation';
  import * as m from '$lib/paraglide/messages';

  const { data } = $props<{
    data: {
      club: { id: string };
      structures: {
        id: string;
        name: string;
        levels: { small_blind: number; big_blind: number; ante: number; duration_minutes: number }[];
        in_use: boolean;
      }[];
    };
  }>();

  function resolveError(key: string): string {
    const msgs = m as unknown as Record<string, (() => string) | undefined>;
    return msgs[key]?.() ?? key;
  }

  type LevelRow =
    | { type: 'level'; small_blind: string; big_blind: string; ante: string; duration_minutes: string; label: string }
    | { type: 'break'; duration_minutes: string; label: string };

  let levels = $state<LevelRow[]>([
    { type: 'level', small_blind: '', big_blind: '', ante: '0', duration_minutes: '', label: '' },
  ]);

  function addLevel() {
    levels = [...levels, { type: 'level', small_blind: '', big_blind: '', ante: '0', duration_minutes: '', label: '' }];
  }

  function addBreak() {
    levels = [...levels, { type: 'break', duration_minutes: '', label: '' }];
  }

  function removeLevel(i: number) {
    levels = levels.filter((_, idx) => idx !== i);
  }

  let name = $state('');
  let loading = $state(false);
  let errorKey = $state<string | null>(null);

  async function handleCreate() {
    if (loading) return;
    errorKey = null;
    if (!name.trim()) { errorKey = 'error_required'; return; }
    if (levels.length === 0) { errorKey = 'error_required'; return; }

    const parsedLevels = levels.map((l) =>
      l.type === 'break'
        ? {
            type: 'break' as const,
            small_blind: 0,
            big_blind: 0,
            ante: 0,
            duration_minutes: Number(l.duration_minutes),
            label: l.label.trim() || 'Break',
          }
        : {
            type: 'level' as const,
            small_blind: Number(l.small_blind),
            big_blind: Number(l.big_blind),
            ante: Number(l.ante),
            duration_minutes: Number(l.duration_minutes),
            label: l.label.trim(),
          }
    );
    for (const level of parsedLevels) {
      if (level.duration_minutes <= 0) { errorKey = 'error_required'; return; }
      if (level.type === 'level') {
        if (level.small_blind <= 0 || level.big_blind < level.small_blind || level.ante < 0) {
          errorKey = 'error_required';
          return;
        }
      }
    }

    loading = true;
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('blind_structures')
        .insert({ club_id: data.club.id, name: name.trim(), levels: parsedLevels });
      if (error) { errorKey = 'server_error'; return; }
      name = '';
      levels = [{ type: 'level', small_blind: '', big_blind: '', ante: '0', duration_minutes: '', label: '' }];
      await invalidateAll();
    } finally {
      loading = false;
    }
  }

  async function handleDelete(id: string) {
    if (loading) return;
    loading = true;
    errorKey = null;
    try {
      const supabase = createClient();
      const { data: linked } = await supabase
        .from('tournaments')
        .select('id')
        .eq('blind_structure_id', id)
        .eq('club_id', data.club.id)
        .limit(1);
      if (linked?.length) { errorKey = 'error_structure_in_use'; return; }
      await supabase.from('blind_structures').delete().eq('id', id).eq('club_id', data.club.id);
      await invalidateAll();
    } finally {
      loading = false;
    }
  }
</script>

<div class="flex flex-col gap-6">
  <h1 class="text-base font-semibold text-foreground">{m.blind_structures_title()}</h1>

  <!-- List -->
  {#if data.structures.length === 0}
    <p class="text-sm text-muted-foreground">{m.blind_structure_empty()}</p>
  {:else}
    <div class="bg-card border border-border rounded-lg overflow-hidden">
      <table class="w-full">
        <thead>
          <tr class="border-b border-border">
            <th class="px-4 py-2.5 text-left font-normal text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap">Name</th>
            <th class="px-4 py-2.5 text-left font-normal text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap">Levels</th>
            <th class="px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {#each data.structures as s}
            <tr class="border-b border-border last:border-0">
              <td class="px-4 py-3 text-sm font-medium text-foreground">{s.name}</td>
              <td class="px-4 py-3 text-xs text-muted-foreground">{s.levels.length}</td>
              <td class="px-4 py-3 text-right">
                {#if s.in_use}
                  <span class="text-xs text-muted-foreground">{m.blind_structure_in_use()}</span>
                {:else}
                  <button type="button" onclick={() => handleDelete(s.id)} class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                    {m.common_delete()}
                  </button>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <!-- Create form -->
  <div class="bg-card border border-border rounded-lg p-5">
    <h2 class="text-sm font-semibold text-foreground mb-4">{m.blind_structure_new_title()}</h2>
    <div class="flex flex-col gap-4 max-w-lg">
      <div>
        <label for="bs-name" class="block text-xs font-medium text-muted-foreground mb-1.5">
          {m.blind_structure_name_label()}
        </label>
        <input
          id="bs-name" type="text"
          bind:value={name}
          class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      <!-- Levels table -->
      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="text-muted-foreground">
              <th class="text-left font-medium pb-2 pr-2 w-10">#</th>
              <th class="text-left font-medium pb-2 pr-2">{m.blind_structure_duration_label()}</th>
              <th class="text-left font-medium pb-2 pr-2">{m.blind_structure_sb_label()}</th>
              <th class="text-left font-medium pb-2 pr-2">{m.blind_structure_bb_label()}</th>
              <th class="text-left font-medium pb-2 pr-2">{m.blind_structure_ante_label()}</th>
              <th class="text-left font-medium pb-2 pr-2">Label</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each levels as level, i}
              <tr>
                <td class="pr-2 pb-2">
                  {#if level.type === 'break'}
                    <span class="inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide bg-accent/15 text-accent">BRK</span>
                  {:else}
                    <span class="text-xs text-muted-foreground">{i + 1 - levels.slice(0, i).filter((l) => l.type === 'break').length}</span>
                  {/if}
                </td>
                <td class="pr-2 pb-2">
                  <input type="number" min="1" bind:value={level.duration_minutes}
                    class="w-20 px-2 py-1.5 bg-background border border-input rounded text-sm text-foreground focus:outline-none focus:border-accent" />
                </td>
                {#if level.type === 'level'}
                  <td class="pr-2 pb-2">
                    <input type="number" min="1" bind:value={level.small_blind}
                      class="w-20 px-2 py-1.5 bg-background border border-input rounded text-sm text-foreground focus:outline-none focus:border-accent" />
                  </td>
                  <td class="pr-2 pb-2">
                    <input type="number" min="1" bind:value={level.big_blind}
                      class="w-20 px-2 py-1.5 bg-background border border-input rounded text-sm text-foreground focus:outline-none focus:border-accent" />
                  </td>
                  <td class="pr-2 pb-2">
                    <input type="number" min="0" bind:value={level.ante}
                      class="w-20 px-2 py-1.5 bg-background border border-input rounded text-sm text-foreground focus:outline-none focus:border-accent" />
                  </td>
                {:else}
                  <td class="pr-2 pb-2 text-muted-foreground text-xs text-center align-middle">—</td>
                  <td class="pr-2 pb-2 text-muted-foreground text-xs text-center align-middle">—</td>
                  <td class="pr-2 pb-2 text-muted-foreground text-xs text-center align-middle">—</td>
                {/if}
                <td class="pr-2 pb-2">
                  {#if level.type === 'break'}
                    <input type="text" bind:value={level.label}
                      placeholder={m.blind_structure_break_label_placeholder()}
                      class="w-36 px-2 py-1.5 bg-background border border-input rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent" />
                  {/if}
                </td>
                <td class="pb-2">
                  {#if levels.length > 1}
                    <button type="button" onclick={() => removeLevel(i)}
                      class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">✕</button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="flex gap-4">
        <button type="button" onclick={addLevel}
          class="self-start text-xs text-accent hover:text-accent/80 transition-colors cursor-pointer">
          + {m.blind_structure_add_level()}
        </button>
        <button type="button" onclick={addBreak}
          class="self-start text-xs text-accent hover:text-accent/80 transition-colors cursor-pointer">
          + {m.blind_structure_add_break()}
        </button>
      </div>

      {#if errorKey}
        <p class="text-xs text-accent">{resolveError(errorKey)}</p>
      {/if}

      <button type="button" onclick={handleCreate}
        class="self-start bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer">
        {m.blind_structure_create_button()}
      </button>
    </div>
  </div>
</div>
