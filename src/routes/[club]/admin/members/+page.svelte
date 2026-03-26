<script lang="ts">
  import { createClient } from '$lib/supabase';
  import { invalidateAll } from '$app/navigation';
  import { page } from '$app/state';
  import * as m from '$lib/paraglide/messages';
  import type { ClubMember } from '$lib/types';

  const { data } = $props<{
    data: {
      club: { id: string };
      member: { user_id: string };
      members: ClubMember[];
      invites: { id: string; created_at: string; expires_at: string }[];
    };
  }>();

  function resolveError(key: string): string {
    const msgs = m as unknown as Record<string, (() => string) | undefined>;
    return msgs[key]?.() ?? key;
  }

  function inviteUrl(id: string) {
    return `${page.url.origin}/invite/${id}`;
  }

  let copied = $state<string | null>(null);
  async function copyLink(id: string) {
    await navigator.clipboard.writeText(inviteUrl(id));
    copied = id;
    setTimeout(() => { copied = null; }, 2000);
  }

  let loading = $state(false);
  let errorKey = $state<string | null>(null);
  let newInviteId = $state<string | null>(null);

  async function handleCreateInvite() {
    if (loading) return;
    loading = true;
    errorKey = null;
    try {
      const supabase = createClient();
      const { data: invite, error } = await supabase
        .from('club_invites')
        .insert({ club_id: data.club.id, created_by: data.member.user_id })
        .select('id')
        .single();
      if (error) { errorKey = 'server_error'; return; }
      newInviteId = invite.id;
      await invalidateAll();
    } finally {
      loading = false;
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    if (loading) return;
    loading = true;
    errorKey = null;
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('club_invites')
        .delete()
        .eq('id', inviteId)
        .eq('club_id', data.club.id);
      if (error) { errorKey = 'server_error'; return; }
      if (inviteId === newInviteId) newInviteId = null;
      await invalidateAll();
    } finally {
      loading = false;
    }
  }

  async function handleRemoveMember(userId: string) {
    if (loading) return;
    if (userId === data.member.user_id) { errorKey = 'error_cannot_remove_self'; return; }
    loading = true;
    errorKey = null;
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('club_members')
        .delete()
        .eq('club_id', data.club.id)
        .eq('user_id', userId);
      if (error) { errorKey = 'server_error'; return; }
      await invalidateAll();
    } finally {
      loading = false;
    }
  }
</script>

<div class="flex flex-col gap-6">
  <!-- Header -->
  <div class="flex items-center gap-3">
    <h1 class="text-base font-semibold text-foreground">{m.members_title()}</h1>
    <span class="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
      {data.members.length}
    </span>
  </div>

  <!-- Member table -->
  <div class="bg-card border border-border rounded-lg overflow-hidden">
    <div class="grid grid-cols-[1fr_80px_80px] border-b border-border px-4 py-2.5">
      <span class="text-[10px] uppercase tracking-widest text-muted-foreground">Name</span>
      <span class="text-[10px] uppercase tracking-widest text-muted-foreground">Role</span>
      <span></span>
    </div>

    {#if data.members.length === 0}
      <p class="px-4 py-4 text-sm text-muted-foreground">{m.members_empty()}</p>
    {:else}
      {#each data.members as member}
        <div class="grid grid-cols-[1fr_80px_80px] px-4 py-3 border-b border-border last:border-0 items-center">
          <span class="text-sm font-medium text-foreground">{member.display_name}</span>
          <span class="text-xs font-medium {member.role === 'admin' ? 'text-accent' : 'text-muted-foreground'}">
            {member.role}
          </span>
          <div class="flex justify-end">
            {#if member.role !== 'admin'}
              <button type="button" onclick={() => handleRemoveMember(member.user_id)} class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                {m.members_remove()}
              </button>
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <!-- Invite links -->
  <div class="bg-card border border-border rounded-lg p-5 flex flex-col gap-4">
    <h2 class="text-sm font-semibold text-foreground">{m.members_invite_title()}</h2>

    {#if errorKey}
      <p class="text-xs text-accent">{resolveError(errorKey)}</p>
    {/if}

    <!-- Active invites list -->
    {#if data.invites.filter((i: { id: string }) => i.id !== newInviteId).length > 0}
      <div class="flex flex-col gap-2">
        {#each data.invites.filter((i: { id: string }) => i.id !== newInviteId) as invite}
          <div class="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2">
            <span class="text-xs text-muted-foreground font-mono truncate flex-1">{inviteUrl(invite.id)}</span>
            <button type="button" onclick={() => copyLink(invite.id)}
              class="text-xs text-accent hover:text-accent/80 transition-colors cursor-pointer flex-shrink-0">
              {copied === invite.id ? m.members_invite_copied() : m.members_invite_copy()}
            </button>
            <button type="button" onclick={() => handleRevokeInvite(invite.id)}
              class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex-shrink-0">
              {m.members_invite_revoke()}
            </button>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Newly created invite -->
    {#if newInviteId}
      <div class="flex items-center gap-2 bg-accent/10 border border-accent/30 rounded-md px-3 py-2">
        <span class="text-xs text-muted-foreground mb-1">{m.members_invite_new_link()}</span>
        <span class="text-xs font-mono text-foreground truncate flex-1">{inviteUrl(newInviteId)}</span>
        <button type="button" onclick={() => copyLink(newInviteId!)}
          class="text-xs text-accent hover:text-accent/80 transition-colors cursor-pointer flex-shrink-0">
          {copied === newInviteId ? m.members_invite_copied() : m.members_invite_copy()}
        </button>
      </div>
    {/if}

    <button type="button" onclick={handleCreateInvite} disabled={loading}
      class="self-start bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
      {m.invite_link_generate()}
    </button>
  </div>
</div>
