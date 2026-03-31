<script lang="ts">
  import { createClient } from '$lib/supabase';
  import { invalidateAll, goto } from '$app/navigation';
  import { displayName } from '$lib/players';
  import * as m from '$lib/paraglide/messages';
  import type { Player } from '$lib/types';

  const { data } = $props<{
    data: {
      club: { id: string; slug: string };
      player: Player;
      targetPlayer: Player;
    };
  }>();

  // --- state ---
  type Mode = 'view' | 'edit';
  let mode = $state<Mode>('view');
  let saving = $state(false);
  let errors = $state<Record<string, string>>({});

  // edit form fields
  let firstName = $state('');
  let lastName = $state('');
  let nickname = $state('');
  let birthday = $state('');
  let country = $state('');
  let city = $state('');
  let phone = $state('');
  let registrationDate = $state('');
  let memberNumber = $state(0);

  // invite state
  let inviteUrl = $state<string | null>(null);
  let copied = $state(false);
  let generatingInvite = $state(false);

  function startEdit() {
    const p = data.targetPlayer;
    firstName = p.first_name;
    lastName = p.last_name;
    nickname = p.nickname ?? '';
    birthday = p.birthday ?? '';
    country = p.country ?? '';
    city = p.city ?? '';
    phone = p.phone ?? '';
    registrationDate = p.created_at ? p.created_at.slice(0, 10) : '';
    memberNumber = p.member_number;
    errors = {};
    inviteUrl = null;
    mode = 'edit';
  }

  function cancelEdit() {
    mode = 'view';
    errors = {};
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = m.error_required();
    if (!lastName.trim()) e.lastName = m.error_required();
    errors = e;
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    saving = true;
    try {
      const supabase = createClient();
      const { error: dbError } = await supabase
        .from('players')
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          nickname: nickname.trim() || null,
          birthday: birthday || null,
          country: country.trim() || null,
          city: city.trim() || null,
          phone: phone.trim() || null,
          created_at: registrationDate ? new Date(registrationDate).toISOString() : undefined,
          member_number: memberNumber,
        })
        .eq('id', data.targetPlayer.id);

      if (dbError) {
        if (dbError.code === '23505') {
          errors = { memberNumber: 'Member number already in use.' };
        } else {
          errors = { form: dbError.message };
        }
        return;
      }

      await invalidateAll();
      mode = 'view';
    } finally {
      saving = false;
    }
  }

  async function handleGenerateInvite() {
    generatingInvite = true;
    try {
      const supabase = createClient();
      const { data: invite, error: dbError } = await supabase
        .from('club_invites')
        .insert({
          club_id: data.club.id,
          created_by: data.player.id,
          player_id: data.targetPlayer.id,
        })
        .select('id')
        .single();

      if (dbError || !invite) {
        errors = { invite: dbError?.message ?? 'Failed to generate invite.' };
        return;
      }

      inviteUrl = `${window.location.origin}/invite/${invite.id}`;
    } finally {
      generatingInvite = false;
    }
  }

  async function copyLink() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    copied = true;
    setTimeout(() => { copied = false; }, 2000);
  }

  async function handleDelete() {
    const supabase = createClient();
    await supabase.from('players').delete().eq('id', data.targetPlayer.id);
    await goto(`/${data.club.slug}/admin/players`);
  }

  // Derive a reactive snapshot so view mode always shows fresh data after save
  let p = $derived(data.targetPlayer);
</script>

<div class="flex flex-col gap-6">
  <!-- Back link -->
  <a
    href="/{data.club.slug}/admin/players"
    class="text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
  >
    ← {m.players_title()}
  </a>

  <!-- Header -->
  <div class="flex items-start justify-between">
    <div>
      <h1 class="text-base font-semibold text-foreground">{displayName(p)}</h1>
      <p class="text-xs text-muted-foreground mt-0.5">#{p.member_number}</p>
    </div>
    {#if mode === 'view'}
      <button
        type="button"
        onclick={startEdit}
        class="bg-accent text-accent-foreground text-xs font-medium px-3 py-1 rounded-md hover:bg-accent/90 transition-colors cursor-pointer"
      >
        {m.player_edit_title()}
      </button>
    {/if}
  </div>

  <!-- Detail / Edit card -->
  <div class="bg-card border border-border rounded-lg p-5 flex flex-col gap-4">
    {#if errors.form}
      <p class="text-xs text-destructive">{errors.form}</p>
    {/if}

    <div class="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
      <!-- First name -->
      <div>
        <p class="text-xs text-muted-foreground mb-0.5">{m.player_first_name_label()}</p>
        {#if mode === 'view'}
          <p class="text-foreground">{p.first_name}</p>
        {:else}
          <input
            type="text"
            bind:value={firstName}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors {errors.firstName ? 'border-destructive' : ''}"
          />
          {#if errors.firstName}
            <p class="text-xs text-destructive mt-0.5">{errors.firstName}</p>
          {/if}
        {/if}
      </div>

      <!-- Last name -->
      <div>
        <p class="text-xs text-muted-foreground mb-0.5">{m.player_last_name_label()}</p>
        {#if mode === 'view'}
          <p class="text-foreground">{p.last_name}</p>
        {:else}
          <input
            type="text"
            bind:value={lastName}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors {errors.lastName ? 'border-destructive' : ''}"
          />
          {#if errors.lastName}
            <p class="text-xs text-destructive mt-0.5">{errors.lastName}</p>
          {/if}
        {/if}
      </div>

      <!-- Nickname -->
      <div class="col-span-2">
        <p class="text-xs text-muted-foreground mb-0.5">{m.player_nickname_label()}</p>
        {#if mode === 'view'}
          <p class="text-foreground">{p.nickname ?? '—'}</p>
        {:else}
          <input
            type="text"
            bind:value={nickname}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
          />
        {/if}
      </div>

      <!-- Member number -->
      <div>
        <p class="text-xs text-muted-foreground mb-0.5">{m.player_member_number_label()}</p>
        {#if mode === 'view'}
          <p class="text-foreground">{p.member_number}</p>
        {:else}
          <input
            type="number"
            bind:value={memberNumber}
            min="1"
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors {errors.memberNumber ? 'border-destructive' : ''}"
          />
          {#if errors.memberNumber}
            <p class="text-xs text-destructive mt-0.5">{errors.memberNumber}</p>
          {/if}
        {/if}
      </div>

      <!-- Birthday -->
      <div>
        <p class="text-xs text-muted-foreground mb-0.5">{m.player_birthday_label()}</p>
        {#if mode === 'view'}
          <p class="text-foreground">{p.birthday ?? '—'}</p>
        {:else}
          <input
            type="date"
            bind:value={birthday}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
          />
        {/if}
      </div>

      <!-- Phone -->
      <div>
        <p class="text-xs text-muted-foreground mb-0.5">{m.player_phone_label()}</p>
        {#if mode === 'view'}
          <p class="text-foreground">{p.phone ?? '—'}</p>
        {:else}
          <input
            type="tel"
            bind:value={phone}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
          />
        {/if}
      </div>

      <!-- Country -->
      <div>
        <p class="text-xs text-muted-foreground mb-0.5">{m.player_country_label()}</p>
        {#if mode === 'view'}
          <p class="text-foreground">{p.country ?? '—'}</p>
        {:else}
          <input
            type="text"
            bind:value={country}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
          />
        {/if}
      </div>

      <!-- City -->
      <div>
        <p class="text-xs text-muted-foreground mb-0.5">{m.player_city_label()}</p>
        {#if mode === 'view'}
          <p class="text-foreground">{p.city ?? '—'}</p>
        {:else}
          <input
            type="text"
            bind:value={city}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
          />
        {/if}
      </div>

      <!-- Registration date -->
      <div>
        <p class="text-xs text-muted-foreground mb-0.5">{m.player_registration_date_label()}</p>
        {#if mode === 'view'}
          <p class="text-foreground">{p.created_at ? p.created_at.slice(0, 10) : '—'}</p>
        {:else}
          <input
            type="date"
            bind:value={registrationDate}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
          />
        {/if}
      </div>
    </div>

    <!-- Edit actions -->
    {#if mode === 'edit'}
      <div class="flex justify-end gap-2 pt-2 border-t border-border">
        <button
          type="button"
          onclick={cancelEdit}
          class="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          {m.player_cancel()}
        </button>
        <button
          type="button"
          onclick={handleSave}
          disabled={saving}
          class="bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {m.player_save()}
        </button>
      </div>
    {/if}
  </div>

  <!-- Account linking section -->
  {#if mode === 'view'}
    <div class="bg-card border border-border rounded-lg p-5 flex flex-col gap-3">
      <div class="flex items-center gap-2">
        {#if p.user_id}
          <span class="w-2 h-2 rounded-full bg-green-500"></span>
          <span class="text-sm text-foreground">{m.player_linked()}</span>
        {:else}
          <span class="w-2 h-2 rounded-full bg-border"></span>
          <span class="text-sm text-muted-foreground">{m.player_not_linked()}</span>
          <button
            type="button"
            onclick={handleGenerateInvite}
            disabled={generatingInvite}
            class="ml-auto text-xs text-accent hover:text-accent/80 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {m.player_generate_invite()}
          </button>
        {/if}
      </div>

      {#if errors.invite}
        <p class="text-xs text-destructive">{errors.invite}</p>
      {/if}

      {#if inviteUrl}
        <div class="flex items-center gap-2">
          <div class="flex-1 bg-accent/10 border border-accent/30 rounded-md px-3 py-2">
            <p class="text-xs text-foreground break-all">{inviteUrl}</p>
          </div>
          <button
            type="button"
            onclick={copyLink}
            class="text-xs text-accent hover:text-accent/80 transition-colors cursor-pointer whitespace-nowrap"
          >
            {copied ? m.invite_copied() : m.invite_copy()}
          </button>
        </div>
      {/if}
    </div>

    <!-- Delete -->
    <div class="flex justify-start">
      <!-- svelte-ignore a11y_consider_explicit_label -->
      <button
        type="button"
        onclick={handleDelete}
        class="text-xs text-muted-foreground hover:text-accent transition-colors cursor-pointer"
      >
        {m.player_remove()}
      </button>
    </div>
  {/if}
</div>
