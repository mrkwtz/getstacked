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

<div class="max-w-2xl">
  <h1 class="text-2xl font-bold mb-6">{m.members_title()}</h1>

  <!-- Member list -->
  <div class="bg-gray-900 rounded-xl overflow-hidden mb-8">
    {#each data.members as member}
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-800 last:border-0">
        <div>
          <span class="font-medium">{member.display_name}</span>
          <span class="ml-2 text-xs px-2 py-0.5 rounded-full {member.role === 'admin' ? 'bg-indigo-900 text-indigo-300' : 'bg-gray-800 text-gray-400'}">
            {member.role}
          </span>
        </div>
        <button type="button" onclick={() => handleRemoveMember(member.user_id)} class="text-sm text-red-400 hover:text-red-300">{m.members_remove()}</button>
      </div>
    {/each}
    {#if data.members.length === 0}
      <p class="px-4 py-3 text-gray-500">{m.members_empty()}</p>
    {/if}
  </div>

  <!-- Invite section -->
  <div class="bg-gray-900 rounded-xl p-6">
    <h2 class="text-lg font-semibold mb-4">{m.members_invite_title()}</h2>

    {#if errorKey}
      <p class="text-red-400 text-sm mb-4">{resolveError(errorKey)}</p>
    {/if}

    <!-- Active invites -->
    {#if data.invites.filter((i: { id: string }) => i.id !== newInviteId).length > 0}
      <div class="space-y-2 mb-4">
        {#each data.invites.filter((i: { id: string }) => i.id !== newInviteId) as invite}
          <div class="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2">
            <span class="text-sm text-gray-400 font-mono truncate">{inviteUrl(invite.id)}</span>
            <div class="flex gap-2 ml-2 shrink-0">
              <button type="button" onclick={() => copyLink(invite.id)} class="text-sm text-indigo-400 hover:text-indigo-300">
                {copied === invite.id ? m.members_invite_copied() : m.members_invite_copy()}
              </button>
              <button type="button" onclick={() => handleRevokeInvite(invite.id)} class="text-sm text-red-400 hover:text-red-300">{m.members_invite_revoke()}</button>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Newly created invite -->
    {#if newInviteId}
      <div class="bg-indigo-950 border border-indigo-700 rounded-lg px-3 py-2 mb-4">
        <p class="text-sm text-indigo-300 mb-1">{m.members_invite_new_link()}</p>
        <div class="flex items-center justify-between">
          <span class="text-sm font-mono text-white truncate">{inviteUrl(newInviteId)}</span>
          <button type="button" onclick={() => copyLink(newInviteId!)} class="text-sm text-indigo-400 hover:text-indigo-300 ml-2 shrink-0">
            {copied === newInviteId ? m.members_invite_copied() : m.members_invite_copy()}
          </button>
        </div>
      </div>
    {/if}

    <button type="button" onclick={handleCreateInvite} disabled={loading} class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
      {m.members_invite_button()}
    </button>
  </div>
</div>
