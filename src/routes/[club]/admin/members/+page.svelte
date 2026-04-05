<script lang="ts">
  import { createClient } from '$lib/supabase';
  import { invalidateAll, goto } from '$app/navigation';
  import * as m from '$lib/paraglide/messages';

  const { data } = $props<{
    data: {
      club: { id: string; slug: string };
      members: {
        id: string;
        first_name: string;
        last_name: string;
        nickname: string | null;
        user_id: string | null;
        member_number: number | null;
        role: string;
        created_at: string;
      }[];
    };
  }>();

  // Compute next available member number
  function nextMemberNumber(): number {
    const numbers = data.members
      .map((mem: { member_number: number | null }) => mem.member_number)
      .filter((n: number | null): n is number => n !== null);
    if (numbers.length === 0) return 1;
    return Math.max(...numbers) + 1;
  }

  let showModal = $state(false);
  let saving = $state(false);
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
  let registrationDate = $state(new Date().toISOString().slice(0, 10));
  let memberNumber = $state(0);
  let role = $state<'admin' | 'member' | 'guest'>('member');

  function openModal() {
    firstName = '';
    lastName = '';
    nickname = '';
    birthday = '';
    country = '';
    city = '';
    phone = '';
    address = '';
    notes = '';
    registrationDate = new Date().toISOString().slice(0, 10);
    memberNumber = nextMemberNumber();
    role = 'member';
    errors = {};
    showModal = true;
  }

  function closeModal() {
    showModal = false;
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
      const { error } = await supabase.from('members').insert({
        club_id: data.club.id,
        role,
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
        ...(role !== 'guest' && { member_number: memberNumber }),
      });
      if (error) {
        errors = { form: error.message };
        return;
      }
      await invalidateAll();
      closeModal();
    } finally {
      saving = false;
    }
  }

  // ── Sorting ──────────────────────────────────────────────────
  type SortKey = 'member_number' | 'first_name' | 'last_name' | 'nickname' | 'created_at';
  let sortKey = $state<SortKey>('member_number');
  let sortAsc = $state(true);

  function setSort(key: SortKey) {
    if (sortKey === key) {
      sortAsc = !sortAsc;
    } else {
      sortKey = key;
      sortAsc = true;
    }
  }

  const sortedMembers = $derived(
    [...data.members].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortAsc ? cmp : -cmp;
    })
  );

  function sortIcon(key: SortKey): string {
    if (sortKey !== key) return '↑';
    return sortAsc ? '↑' : '↓';
  }

  function formatDate(iso: string): string {
    return iso.slice(0, 10);
  }
</script>

<div class="flex flex-col gap-6">
  <!-- Header -->
  <div class="flex items-start justify-between">
    <h1 class="text-base font-semibold text-foreground">{m.members_title()}</h1>
    <button
      type="button"
      onclick={openModal}
      class="bg-accent text-accent-foreground text-xs font-medium px-3 py-1 rounded-md hover:bg-accent/90 transition-colors cursor-pointer"
    >
      {m.member_add_button()}
    </button>
  </div>

  <!-- Table -->
  {#if data.members.length === 0}
    <p class="text-sm text-muted-foreground">{m.members_empty()}</p>
  {:else}
    <div class="bg-card border border-border rounded-lg overflow-hidden">
      <table class="w-full">
        <thead>
          <tr class="border-b border-border">
            <th class="px-4 py-2.5 text-left font-normal">
              <button type="button" onclick={() => setSort('member_number')}
                class="text-[10px] uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-foreground transition-colors whitespace-nowrap">
                {m.member_member_number_label()} <span class={sortKey === 'member_number' ? '' : 'opacity-30'}>{sortIcon('member_number')}</span>
              </button>
            </th>
            <th class="px-4 py-2.5 text-left font-normal">
              <button type="button" onclick={() => setSort('first_name')}
                class="text-[10px] uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-foreground transition-colors whitespace-nowrap">
                {m.member_first_name_label()} <span class={sortKey === 'first_name' ? '' : 'opacity-30'}>{sortIcon('first_name')}</span>
              </button>
            </th>
            <th class="px-4 py-2.5 text-left font-normal">
              <button type="button" onclick={() => setSort('last_name')}
                class="text-[10px] uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-foreground transition-colors whitespace-nowrap">
                {m.member_last_name_label()} <span class={sortKey === 'last_name' ? '' : 'opacity-30'}>{sortIcon('last_name')}</span>
              </button>
            </th>
            <th class="px-4 py-2.5 text-left font-normal">
              <button type="button" onclick={() => setSort('nickname')}
                class="text-[10px] uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-foreground transition-colors whitespace-nowrap">
                {m.member_nickname_label()} <span class={sortKey === 'nickname' ? '' : 'opacity-30'}>{sortIcon('nickname')}</span>
              </button>
            </th>
            <th class="px-4 py-2.5 text-left font-normal">
              <button type="button" onclick={() => setSort('created_at')}
                class="text-[10px] uppercase tracking-widest text-muted-foreground cursor-pointer hover:text-foreground transition-colors whitespace-nowrap">
                {m.member_registration_date_label()} <span class={sortKey === 'created_at' ? '' : 'opacity-30'}>{sortIcon('created_at')}</span>
              </button>
            </th>
            <th class="px-4 py-2.5 text-left font-normal">
              <span class="text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                {m.member_role_label()}
              </span>
            </th>
            <th class="px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {#each sortedMembers as member}
            <tr onclick={() => goto(`/${data.club.slug}/admin/members/${member.id}`)}
              class="border-b border-border last:border-0 hover:bg-card/80 cursor-pointer transition-colors">
              <td class="px-4 py-3 text-xs text-muted-foreground">
                {#if member.member_number !== null}
                  {member.member_number}
                {:else}
                  <span class="text-muted-foreground/30">—</span>
                {/if}
              </td>
              <td class="px-4 py-3 text-sm font-medium text-foreground">{member.first_name}</td>
              <td class="px-4 py-3 text-sm text-foreground">{member.last_name}</td>
              <td class="px-4 py-3 text-xs text-muted-foreground">{member.nickname ?? ''}</td>
              <td class="px-4 py-3 text-xs text-muted-foreground">{formatDate(member.created_at)}</td>
              <td class="px-4 py-3">
                {#if member.role === 'guest'}
                  <span class="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">{m.member_role_guest()}</span>
                {:else if member.role === 'admin'}
                  <span class="text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent font-medium">{m.member_role_admin()}</span>
                {/if}
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center justify-center">
                  {#if member.user_id}
                    <span class="w-2 h-2 rounded-full bg-green-500" title={m.member_linked()}></span>
                  {:else}
                    <span class="w-2 h-2 rounded-full bg-muted-foreground/30" title={m.member_not_linked()}></span>
                  {/if}
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<!-- Add Member Modal -->
{#if showModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    onclick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
  >
    <div class="bg-card rounded-xl p-6 max-w-md w-full mx-4 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
      <h2 class="text-base font-semibold text-foreground">{m.member_add_button()}</h2>

      {#if errors.form}
        <p class="text-xs text-destructive">{errors.form}</p>
      {/if}

      <div class="grid grid-cols-2 gap-3">
        <!-- First name -->
        <div class="flex flex-col gap-1">
          <label for="firstName" class="block text-xs font-medium text-muted-foreground mb-1">
            {m.member_first_name_label()} *
          </label>
          <input
            id="firstName"
            type="text"
            bind:value={firstName}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors {errors.firstName ? 'border-destructive' : ''}"
          />
          {#if errors.firstName}
            <p class="text-xs text-destructive">{errors.firstName}</p>
          {/if}
        </div>

        <!-- Last name -->
        <div class="flex flex-col gap-1">
          <label for="lastName" class="block text-xs font-medium text-muted-foreground mb-1">
            {m.member_last_name_label()} *
          </label>
          <input
            id="lastName"
            type="text"
            bind:value={lastName}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors {errors.lastName ? 'border-destructive' : ''}"
          />
          {#if errors.lastName}
            <p class="text-xs text-destructive">{errors.lastName}</p>
          {/if}
        </div>

        <!-- Nickname -->
        <div class="flex flex-col gap-1 col-span-2">
          <label for="nickname" class="block text-xs font-medium text-muted-foreground mb-1">
            {m.member_nickname_label()}
          </label>
          <input
            id="nickname"
            type="text"
            bind:value={nickname}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        <!-- Birthday -->
        <div class="flex flex-col gap-1">
          <label for="birthday" class="block text-xs font-medium text-muted-foreground mb-1">
            {m.member_birthday_label()}
          </label>
          <input
            id="birthday"
            type="date"
            bind:value={birthday}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        <!-- Country -->
        <div class="flex flex-col gap-1">
          <label for="country" class="block text-xs font-medium text-muted-foreground mb-1">
            {m.member_country_label()}
          </label>
          <input
            id="country"
            type="text"
            bind:value={country}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        <!-- City -->
        <div class="flex flex-col gap-1">
          <label for="city" class="block text-xs font-medium text-muted-foreground mb-1">
            {m.member_city_label()}
          </label>
          <input
            id="city"
            type="text"
            bind:value={city}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        <!-- Phone -->
        <div class="flex flex-col gap-1">
          <label for="phone" class="block text-xs font-medium text-muted-foreground mb-1">
            {m.member_phone_label()}
          </label>
          <input
            id="phone"
            type="tel"
            bind:value={phone}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        <!-- Address -->
        <div class="flex flex-col gap-1 col-span-2">
          <label for="address" class="block text-xs font-medium text-muted-foreground mb-1">
            {m.member_address_label()}
          </label>
          <input
            id="address"
            type="text"
            bind:value={address}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        <!-- Notes -->
        <div class="flex flex-col gap-1 col-span-2">
          <label for="notes" class="block text-xs font-medium text-muted-foreground mb-1">
            {m.member_notes_label()}
          </label>
          <textarea
            id="notes"
            bind:value={notes}
            rows={3}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors resize-none"
          ></textarea>
        </div>

        <!-- Registration date -->
        <div class="flex flex-col gap-1">
          <label for="registrationDate" class="block text-xs font-medium text-muted-foreground mb-1">
            {m.member_registration_date_label()}
          </label>
          <input
            id="registrationDate"
            type="date"
            bind:value={registrationDate}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        {#if role !== 'guest'}
          <!-- Member number -->
          <div class="flex flex-col gap-1">
            <label for="memberNumber" class="block text-xs font-medium text-muted-foreground mb-1">
              {m.member_member_number_label()}
            </label>
            <input
              id="memberNumber"
              type="number"
              bind:value={memberNumber}
              min="1"
              class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
            />
          </div>
        {/if}

        <!-- Role -->
        <div class="flex flex-col gap-1 col-span-2">
          <label for="role" class="block text-xs font-medium text-muted-foreground mb-1">
            {m.member_role_label()}
          </label>
          <select
            id="role"
            bind:value={role}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
          >
            <option value="member">{m.member_role_member()}</option>
            <option value="admin">{m.member_role_admin()}</option>
            <option value="guest">{m.member_role_guest()}</option>
          </select>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onclick={closeModal}
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
    </div>
  </div>
{/if}
