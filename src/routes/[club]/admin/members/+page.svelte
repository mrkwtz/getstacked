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
        <form method="POST" action="?/remove_member" use:enhance>
          <input type="hidden" name="user_id" value={member.user_id} />
          <button type="submit" class="text-sm text-red-400 hover:text-red-300">{m.members_remove()}</button>
        </form>
      </div>
    {/each}
    {#if data.members.length === 0}
      <p class="px-4 py-3 text-gray-500">{m.members_empty()}</p>
    {/if}
  </div>

  <!-- Invite form -->
  <div class="bg-gray-900 rounded-xl p-6">
    <h2 class="text-lg font-semibold mb-4">{m.members_invite_title()}</h2>
    <form method="POST" action="?/invite_member" use:enhance class="space-y-4">
      <div>
        <label for="email" class="block text-sm font-medium text-gray-300 mb-1">{m.members_invite_email()}</label>
        <input id="email" name="email" type="email" required
          class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
          placeholder="member@example.com" />
      </div>
      <div>
        <label for="display_name" class="block text-sm font-medium text-gray-300 mb-1">{m.members_invite_display_name()}</label>
        <input id="display_name" name="display_name" type="text" required
          class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
          placeholder="Poker Pete" />
      </div>
      {#if form?.errorKey}
        <p class="text-red-400 text-sm">{resolveError(form.errorKey)}</p>
      {/if}
      {#if form?.invited}
        <p class="text-green-400 text-sm">{m.members_invited_success()}</p>
      {/if}
      <button type="submit" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors">
        {m.members_invite_button()}
      </button>
    </form>
  </div>
</div>
