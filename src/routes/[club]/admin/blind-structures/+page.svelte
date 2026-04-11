<script lang="ts">
  import { createClient } from '$lib/supabase';
  import { invalidateAll } from '$app/navigation';
  import * as m from '$lib/paraglide/messages';
  import BlindStructureForm from '$lib/components/BlindStructureForm.svelte';
  import type { LevelRow } from '$lib/components/BlindStructureForm.svelte';

  const { data } = $props<{
    data: {
      club: { id: string };
      structures: {
        id: string;
        name: string;
        levels: { type?: string; small_blind: number; big_blind: number; ante: number; duration_minutes: number; label?: string }[];
      }[];
    };
  }>();

  function resolveError(key: string): string {
    const msgs = m as unknown as Record<string, (() => string) | undefined>;
    return msgs[key]?.() ?? key;
  }

  let levels = $state<LevelRow[]>([
    { type: 'level', small_blind: '', big_blind: '', ante: '0', duration_minutes: '', label: '' },
  ]);

  let name = $state('');
  let loading = $state(false);
  let errorKey = $state<string | null>(null);
  let editingId = $state<string | null>(null);

  function startEdit(s: typeof data.structures[number]) {
    editingId = s.id;
    name = s.name;
    levels = s.levels.map((l: { type?: string; small_blind: number; big_blind: number; ante: number; duration_minutes: number; label?: string }) =>
      (l.type === 'break')
        ? { type: 'break' as const, duration_minutes: String(l.duration_minutes), label: l.label ?? '' }
        : { type: 'level' as const, small_blind: String(l.small_blind), big_blind: String(l.big_blind), ante: String(l.ante), duration_minutes: String(l.duration_minutes), label: l.label ?? '' }
    );
    errorKey = null;
    document.getElementById('bs-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function cancelEdit() {
    editingId = null;
    name = '';
    levels = [{ type: 'level', small_blind: '', big_blind: '', ante: '0', duration_minutes: '', label: '' }];
    errorKey = null;
  }

  function parseLevels() {
    return levels.map((l) =>
      l.type === 'break'
        ? { type: 'break' as const, small_blind: 0, big_blind: 0, ante: 0, duration_minutes: Number(l.duration_minutes), label: l.label.trim() || 'Break' }
        : { type: 'level' as const, small_blind: Number(l.small_blind), big_blind: Number(l.big_blind), ante: Number(l.ante), duration_minutes: Number(l.duration_minutes), label: l.label.trim() }
    );
  }

  function validateLevels(parsed: ReturnType<typeof parseLevels>): boolean {
    for (const level of parsed) {
      if (level.duration_minutes <= 0) return false;
      if (level.type === 'level') {
        if (level.small_blind <= 0 || level.big_blind < level.small_blind || level.ante < 0) return false;
      }
    }
    return true;
  }

  async function handleSubmit() {
    if (loading) return;
    errorKey = null;
    if (!name.trim()) { errorKey = 'error_required'; return; }
    if (levels.length === 0) { errorKey = 'error_required'; return; }
    const parsedLevels = parseLevels();
    if (!validateLevels(parsedLevels)) { errorKey = 'error_required'; return; }

    loading = true;
    try {
      const supabase = createClient();
      if (editingId) {
        const { error } = await supabase
          .from('blind_structures')
          .update({ name: name.trim(), levels: parsedLevels })
          .eq('id', editingId)
          .eq('club_id', data.club.id);
        if (error) { errorKey = 'server_error'; return; }
      } else {
        const { error } = await supabase
          .from('blind_structures')
          .insert({ club_id: data.club.id, name: name.trim(), levels: parsedLevels });
        if (error) { errorKey = 'server_error'; return; }
      }
      cancelEdit();
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
                <div class="flex justify-end gap-3">
                  <button type="button" onclick={() => startEdit(s)}
                    class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                    {m.blind_structure_edit_button()}
                  </button>
                  <button type="button" onclick={() => handleDelete(s.id)}
                    class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                    {m.common_delete()}
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <!-- Create/Edit form -->
  <div id="bs-form" class="bg-card border border-border rounded-lg p-5">
    <h2 class="text-sm font-semibold text-foreground mb-4">
      {editingId ? m.blind_structure_edit_title() : m.blind_structure_new_title()}
    </h2>
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

      <BlindStructureForm bind:levels />

      {#if errorKey}
        <p class="text-xs text-accent">{resolveError(errorKey)}</p>
      {/if}

      <div class="flex gap-3">
        <button type="button" onclick={handleSubmit}
          class="bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer">
          {editingId ? m.blind_structure_save_button() : m.blind_structure_create_button()}
        </button>
        {#if editingId}
          <button type="button" onclick={cancelEdit}
            class="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
            {m.tournament_cancel_review()}
          </button>
        {/if}
      </div>
    </div>
  </div>
</div>
