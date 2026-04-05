<script lang="ts">
  import { createClient } from '$lib/supabase';
  import { invalidateAll, goto } from '$app/navigation';
  import { displayName, isGuest, isLastAdmin } from '$lib/members';
  import * as m from '$lib/paraglide/messages';
  import type { Member } from '$lib/types';

  const { data } = $props<{
    data: {
      club: { id: string; slug: string };
      currentMember: Member;
      targetMember: Member;
      pendingInviteId: string | null;
      clubMembers: { id: string; role: string }[];
    };
  }>();

  type Mode = 'view' | 'edit';
  let mode = $state<Mode>('view');
  let saving = $state(false);
  let deleting = $state(false);
  let showDeleteModal = $state(false);
  let errors = $state<Record<string, string>>({});

  let firstName = $state('');
  let lastName = $state('');
  let nickname = $state('');
  let birthday = $state('');
  let country = $state('');
  let city = $state('');
  let phone = $state('');
  let address = $state('');
  let notes = $state('');
  let registrationDate = $state('');
  let memberNumber = $state(0);

  let copied = $state(false);
  let generatingInvite = $state(false);
  let revokingInvite = $state(false);

  const inviteUrl = $derived(
    data.pendingInviteId ? `${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${data.pendingInviteId}` : null
  );

  function startEdit() {
    const mem = data.targetMember;
    firstName = mem.first_name;
    lastName = mem.last_name;
    nickname = mem.nickname ?? '';
    birthday = mem.birthday ?? '';
    country = mem.country ?? '';
    city = mem.city ?? '';
    phone = mem.phone ?? '';
    address = mem.address ?? '';
    notes = mem.notes ?? '';
    registrationDate = mem.created_at ? mem.created_at.slice(0, 10) : '';
    memberNumber = mem.member_number;
    errors = {};
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
        .from('members')
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          nickname: nickname.trim() || null,
          birthday: birthday || null,
          country: country.trim() || null,
          city: city.trim() || null,
          phone: phone.trim() || null,
          address: address.trim() || null,
          notes: notes.trim() || null,
          created_at: registrationDate ? new Date(registrationDate).toISOString() : undefined,
          member_number: memberNumber,
        })
        .eq('id', data.targetMember.id);

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
      const { error: dbError } = await supabase
        .from('club_invites')
        .insert({
          club_id: data.club.id,
          created_by: data.currentMember.user_id!,
          member_id: data.targetMember.id,
        });

      if (dbError) {
        errors = { invite: dbError.message };
        return;
      }

      await invalidateAll();
    } finally {
      generatingInvite = false;
    }
  }

  async function handleRevokeInvite() {
    if (!data.pendingInviteId) return;
    revokingInvite = true;
    try {
      const supabase = createClient();
      await supabase.from('club_invites').delete().eq('id', data.pendingInviteId);
      await invalidateAll();
    } finally {
      revokingInvite = false;
    }
  }

  async function copyLink() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    copied = true;
    setTimeout(() => { copied = false; }, 2000);
  }

  async function handleDelete() {
    deleting = true;
    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase.from('members').delete().eq('id', data.targetMember.id);
      if (deleteError) {
        errors = { form: deleteError.message };
        return;
      }
      await goto(`/${data.club.slug}/admin/members`);
    } finally {
      deleting = false;
      showDeleteModal = false;
    }
  }

  let mem = $derived(data.targetMember);
</script>

<div class="flex flex-col gap-6">
  <!-- Back link -->
  <a
    href="/{data.club.slug}/admin/members"
    class="text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
  >
    ← {m.members_title()}
  </a>

  <!-- Header -->
  <div class="flex items-start justify-between">
    <div>
      <h1 class="text-base font-semibold text-foreground">{displayName(mem)}</h1>
      {#if mem.role === 'guest'}
        <span class="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium mt-0.5 inline-block">{m.member_role_guest()}</span>
      {:else if mem.role === 'admin'}
        <span class="text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent font-medium mt-0.5 inline-block">{m.member_role_admin()}</span>
      {/if}
      {#if !isGuest(mem)}
        <p class="text-xs text-muted-foreground mt-0.5">#{mem.member_number}</p>
      {/if}
    </div>
    {#if mode === 'view'}
      <div class="flex items-center gap-2">
        <button
          type="button"
          onclick={startEdit}
          class="bg-accent text-accent-foreground text-xs font-medium px-3 py-1 rounded-md hover:bg-accent/90 transition-colors cursor-pointer"
        >
          {m.member_edit_title()}
        </button>
        <button
          type="button"
          onclick={() => showDeleteModal = true}
          class="w-7 h-7 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:text-destructive hover:border-destructive transition-colors cursor-pointer"
          aria-label={m.member_remove()}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </button>
      </div>
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
        <p class="text-xs text-muted-foreground mb-0.5">{m.member_first_name_label()}</p>
        {#if mode === 'view'}
          <p class="text-foreground">{mem.first_name}</p>
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
        <p class="text-xs text-muted-foreground mb-0.5">{m.member_last_name_label()}</p>
        {#if mode === 'view'}
          <p class="text-foreground">{mem.last_name}</p>
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
        <p class="text-xs text-muted-foreground mb-0.5">{m.member_nickname_label()}</p>
        {#if mode === 'view'}
          <p class="text-foreground">{mem.nickname ?? '—'}</p>
        {:else}
          <input
            type="text"
            bind:value={nickname}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
          />
        {/if}
      </div>

      <!-- Member number -->
      {#if !isGuest(mem)}
      <div>
        <p class="text-xs text-muted-foreground mb-0.5">{m.member_member_number_label()}</p>
        {#if mode === 'view'}
          <p class="text-foreground">{mem.member_number}</p>
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
      {/if}

      <!-- Birthday -->
      <div>
        <p class="text-xs text-muted-foreground mb-0.5">{m.member_birthday_label()}</p>
        {#if mode === 'view'}
          <p class="text-foreground">{mem.birthday ?? '—'}</p>
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
        <p class="text-xs text-muted-foreground mb-0.5">{m.member_phone_label()}</p>
        {#if mode === 'view'}
          <p class="text-foreground">{mem.phone ?? '—'}</p>
        {:else}
          <input
            type="tel"
            bind:value={phone}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
          />
        {/if}
      </div>

      <!-- Address -->
      <div class="col-span-2">
        <p class="text-xs text-muted-foreground mb-0.5">{m.member_address_label()}</p>
        {#if mode === 'view'}
          <p class="text-foreground">{mem.address ?? '—'}</p>
        {:else}
          <input
            type="text"
            bind:value={address}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
          />
        {/if}
      </div>

      <!-- Country -->
      <div>
        <p class="text-xs text-muted-foreground mb-0.5">{m.member_country_label()}</p>
        {#if mode === 'view'}
          <p class="text-foreground">{mem.country ?? '—'}</p>
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
        <p class="text-xs text-muted-foreground mb-0.5">{m.member_city_label()}</p>
        {#if mode === 'view'}
          <p class="text-foreground">{mem.city ?? '—'}</p>
        {:else}
          <input
            type="text"
            bind:value={city}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
          />
        {/if}
      </div>

      <!-- Notes -->
      <div class="col-span-2">
        <p class="text-xs text-muted-foreground mb-0.5">{m.member_notes_label()}</p>
        {#if mode === 'view'}
          <p class="text-foreground whitespace-pre-wrap">{mem.notes ?? '—'}</p>
        {:else}
          <textarea
            bind:value={notes}
            rows={3}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors resize-none"
          ></textarea>
        {/if}
      </div>

      <!-- Registration date -->
      <div>
        <p class="text-xs text-muted-foreground mb-0.5">{m.member_registration_date_label()}</p>
        {#if mode === 'view'}
          <p class="text-foreground">{mem.created_at ? mem.created_at.slice(0, 10) : '—'}</p>
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
          {m.member_cancel()}
        </button>
        <button
          type="button"
          onclick={handleSave}
          disabled={saving}
          class="bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {m.member_save()}
        </button>
      </div>
    {/if}
  </div>

  <!-- Account linking section -->
  {#if mode === 'view' && !isGuest(mem)}
    <div class="bg-card border border-border rounded-lg p-5 flex flex-col gap-3">
      <div class="flex items-center gap-2">
        {#if mem.user_id}
          <span class="w-2 h-2 rounded-full bg-green-500"></span>
          <span class="text-sm text-foreground">{m.member_linked()}</span>
        {:else}
          <span class="w-2 h-2 rounded-full bg-border"></span>
          <span class="text-sm text-muted-foreground">{m.member_not_linked()}</span>
          <button
            type="button"
            onclick={handleGenerateInvite}
            disabled={generatingInvite}
            class="ml-auto text-xs text-accent hover:text-accent/80 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {m.member_generate_invite()}
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
          <button
            type="button"
            onclick={handleRevokeInvite}
            disabled={revokingInvite}
            class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            {m.invite_link_revoke()}
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- Delete confirmation modal -->
{#if showDeleteModal}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    onkeydown={(e) => e.key === 'Escape' && (showDeleteModal = false)}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="fixed inset-0" onclick={() => showDeleteModal = false}></div>
    <div class="relative bg-card border border-border rounded-lg p-6 w-full max-w-sm shadow-lg flex flex-col gap-4">
      <h2 class="text-sm font-semibold text-foreground">{m.member_delete_confirm_title()}</h2>
      <p class="text-sm text-muted-foreground">
        {m.member_delete_confirm_body({ name: displayName(mem) })}
      </p>
      <div class="flex justify-end gap-2">
        <button
          type="button"
          onclick={() => showDeleteModal = false}
          class="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          {m.member_cancel()}
        </button>
        <button
          type="button"
          onclick={handleDelete}
          disabled={deleting}
          class="bg-destructive text-destructive-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-destructive/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {m.member_delete_confirm()}
        </button>
      </div>
    </div>
  </div>
{/if}
