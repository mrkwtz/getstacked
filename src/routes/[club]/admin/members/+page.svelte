<script lang="ts">
  import { enhance } from '$app/forms';
  import * as m from '$lib/paraglide/messages';
  import type { ClubMember } from '$lib/types';

  const { data, form } = $props<{
    data: { members: ClubMember[] };
    form: { invited?: boolean; errorKey?: string } | null;
  }>();

  function resolveError(key: string): string {
    const msgs = m as Record<string, (() => string) | undefined>;
    return msgs[key]?.() ?? key;
  }
</script>

<div class="flex flex-col gap-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-3">
      <h1 class="text-base font-semibold text-foreground">{m.members_title()}</h1>
      <span class="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
        {data.members.length}
      </span>
    </div>
  </div>

  <!-- Member table -->
  <div class="bg-card border border-border rounded-lg overflow-hidden">
    <!-- Table header -->
    <div class="grid grid-cols-[1fr_80px_80px] border-b border-border px-4 py-2.5">
      <span class="text-[10px] uppercase tracking-widest text-muted-foreground">Name</span>
      <span class="text-[10px] uppercase tracking-widest text-muted-foreground">Role</span>
      <span class="text-[10px] uppercase tracking-widest text-muted-foreground"></span>
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
                <button
                  type="submit"
                  class="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  {m.members_remove()}
                </button>
              </form>
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <!-- Invite form -->
  <div class="bg-card border border-border rounded-lg p-5">
    <h2 class="text-sm font-semibold text-foreground mb-4">{m.members_invite_title()}</h2>
    <form method="POST" action="?/invite_member" use:enhance class="flex flex-col gap-3 max-w-sm">
      <div>
        <label for="email" class="block text-xs font-medium text-muted-foreground mb-1.5">
          {m.members_invite_email()}
        </label>
        <input
          id="email" name="email" type="email" required
          placeholder="member@example.com"
          class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
        />
      </div>
      <div>
        <label for="display_name" class="block text-xs font-medium text-muted-foreground mb-1.5">
          {m.members_invite_display_name()}
        </label>
        <input
          id="display_name" name="display_name" type="text" required
          placeholder="Poker Pete"
          class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent transition-colors"
        />
      </div>

      {#if form?.errorKey}
        <p class="text-xs text-accent">{resolveError(form.errorKey)}</p>
      {/if}
      {#if form?.invited}
        <p class="text-xs text-green-500">{m.members_invited_success()}</p>
      {/if}

      <button
        type="submit"
        class="self-start bg-accent text-accent-foreground text-sm font-medium px-4 py-2 rounded-md hover:bg-accent/90 transition-colors cursor-pointer"
      >
        {m.members_invite_button()}
      </button>
    </form>
  </div>
</div>
