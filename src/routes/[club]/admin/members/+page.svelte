<script lang="ts">
  import { enhance } from '$app/forms';
  import { page } from '$app/state';
  import * as m from '$lib/paraglide/messages';
  import type { ClubMember } from '$lib/types';

  const { data, form } = $props<{
    data: { members: ClubMember[]; invites: { id: string; created_at: string; expires_at: string }[] };
    form: { createdInviteId?: string; errorKey?: string } | null;
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
              <form method="POST" action="?/remove_member" use:enhance>
                <input type="hidden" name="user_id" value={member.user_id} />
                <button type="submit" class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                  {m.members_remove()}
                </button>
              </form>
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <!-- Invite links -->
  <div class="bg-card border border-border rounded-lg p-5 flex flex-col gap-4">
    <h2 class="text-sm font-semibold text-foreground">{m.members_invite_title()}</h2>

    <!-- Active invites list -->
    {#if data.invites.length > 0 || form?.createdInviteId}
      <div class="flex flex-col gap-2">
        {#if form?.createdInviteId}
          <div class="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2">
            <span class="text-xs text-muted-foreground font-mono truncate flex-1">{inviteUrl(form.createdInviteId)}</span>
            <button type="button" onclick={() => copyLink(form!.createdInviteId!)}
              class="text-xs text-accent hover:text-accent/80 transition-colors cursor-pointer flex-shrink-0">
              {copied === form.createdInviteId ? m.invite_link_copied() : m.invite_link_copy()}
            </button>
          </div>
        {/if}
        {#each data.invites.filter((i: { id: string }) => i.id !== form?.createdInviteId) as invite}
          <div class="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2">
            <span class="text-xs text-muted-foreground font-mono truncate flex-1">{inviteUrl(invite.id)}</span>
            <button type="button" onclick={() => copyLink(invite.id)}
              class="text-xs text-accent hover:text-accent/80 transition-colors cursor-pointer flex-shrink-0">
              {copied === invite.id ? m.invite_link_copied() : m.invite_link_copy()}
            </button>
            <form method="POST" action="?/revoke_invite" use:enhance>
              <input type="hidden" name="invite_id" value={invite.id} />
              <button type="submit" class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex-shrink-0">
                {m.invite_link_revoke()}
              </button>
            </form>
          </div>
        {/each}
      </div>
    {/if}

    {#if form?.errorKey}
      <p class="text-xs text-accent">{resolveError(form.errorKey)}</p>
    {/if}

    <form method="POST" action="?/create_invite" use:enhance>
      <button type="submit"
        class="bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer">
        {m.invite_link_generate()}
      </button>
    </form>
  </div>
</div>
