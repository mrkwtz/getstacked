<script lang="ts">
  import { createClient } from '$lib/supabase';
  import { invalidateAll } from '$app/navigation';
  import * as m from '$lib/paraglide/messages';

  const { data } = $props<{
    data: {
      club: { id: string; slug: string };
      players: {
        id: string;
        first_name: string;
        last_name: string;
        nickname: string | null;
        user_id: string | null;
        member_number: number;
      }[];
    };
  }>();

  // Compute next available member number
  function nextMemberNumber(): number {
    if (data.players.length === 0) return 1;
    return Math.max(...data.players.map((p) => p.member_number)) + 1;
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
  let registrationDate = $state(new Date().toISOString().slice(0, 10));
  let memberNumber = $state(0);

  function openModal() {
    firstName = '';
    lastName = '';
    nickname = '';
    birthday = '';
    country = '';
    city = '';
    phone = '';
    registrationDate = new Date().toISOString().slice(0, 10);
    memberNumber = nextMemberNumber();
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
      const { error } = await supabase.from('players').insert({
        club_id: data.club.id,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        nickname: nickname.trim() || null,
        birthday: birthday || null,
        country: country.trim() || null,
        city: city.trim() || null,
        phone: phone.trim() || null,
        created_at: registrationDate ? new Date(registrationDate).toISOString() : undefined,
        member_number: memberNumber,
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
</script>

<div class="flex flex-col gap-6">
  <!-- Header -->
  <div class="flex items-start justify-between">
    <h1 class="text-base font-semibold text-foreground">{m.players_title()}</h1>
    <button
      type="button"
      onclick={openModal}
      class="bg-accent text-accent-foreground text-xs font-medium px-3 py-1 rounded-md hover:bg-accent/90 transition-colors cursor-pointer"
    >
      {m.player_add_button()}
    </button>
  </div>

  <!-- Table -->
  {#if data.players.length === 0}
    <p class="text-sm text-muted-foreground">{m.players_empty()}</p>
  {:else}
    <div class="bg-card border border-border rounded-lg overflow-hidden">
      <div class="grid grid-cols-[60px_1fr_1fr_1fr_40px] border-b border-border px-4 py-2.5">
        <span class="text-[10px] uppercase tracking-widest text-muted-foreground">{m.player_member_number_label()}</span>
        <span class="text-[10px] uppercase tracking-widest text-muted-foreground">{m.player_first_name_label()}</span>
        <span class="text-[10px] uppercase tracking-widest text-muted-foreground">{m.player_last_name_label()}</span>
        <span class="text-[10px] uppercase tracking-widest text-muted-foreground">{m.player_nickname_label()}</span>
        <span></span>
      </div>
      {#each data.players as player}
        <a
          href="/{data.club.slug}/admin/players/{player.id}"
          class="grid grid-cols-[60px_1fr_1fr_1fr_40px] px-4 py-3 border-b border-border last:border-0 items-center hover:bg-card/80 transition-colors"
        >
          <span class="text-xs text-muted-foreground">{player.member_number}</span>
          <span class="text-sm font-medium text-foreground">{player.first_name}</span>
          <span class="text-sm text-foreground">{player.last_name}</span>
          <span class="text-xs text-muted-foreground">{player.nickname ?? ''}</span>
          <span class="flex items-center justify-center">
            {#if player.user_id}
              <span
                class="w-2 h-2 rounded-full bg-green-500"
                title={m.player_linked()}
              ></span>
            {:else}
              <span
                class="w-2 h-2 rounded-full bg-muted-foreground/30"
                title={m.player_not_linked()}
              ></span>
            {/if}
          </span>
        </a>
      {/each}
    </div>
  {/if}
</div>

<!-- Add Player Modal -->
{#if showModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    onclick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
  >
    <div class="bg-card rounded-xl p-6 max-w-md w-full mx-4 flex flex-col gap-4">
      <h2 class="text-base font-semibold text-foreground">{m.player_add_button()}</h2>

      {#if errors.form}
        <p class="text-xs text-destructive">{errors.form}</p>
      {/if}

      <div class="grid grid-cols-2 gap-3">
        <!-- First name -->
        <div class="flex flex-col gap-1">
          <label for="firstName" class="block text-xs font-medium text-muted-foreground mb-1">
            {m.player_first_name_label()} *
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
            {m.player_last_name_label()} *
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
            {m.player_nickname_label()}
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
            {m.player_birthday_label()}
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
            {m.player_country_label()}
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
            {m.player_city_label()}
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
            {m.player_phone_label()}
          </label>
          <input
            id="phone"
            type="tel"
            bind:value={phone}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        <!-- Registration date -->
        <div class="flex flex-col gap-1">
          <label for="registrationDate" class="block text-xs font-medium text-muted-foreground mb-1">
            {m.player_registration_date_label()}
          </label>
          <input
            id="registrationDate"
            type="date"
            bind:value={registrationDate}
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
          />
        </div>

        <!-- Member number -->
        <div class="flex flex-col gap-1">
          <label for="memberNumber" class="block text-xs font-medium text-muted-foreground mb-1">
            {m.player_member_number_label()}
          </label>
          <input
            id="memberNumber"
            type="number"
            bind:value={memberNumber}
            min="1"
            class="w-full px-3 py-2 bg-background border border-input rounded-md text-sm text-foreground focus:outline-none focus:border-accent transition-colors"
          />
        </div>
      </div>

      <!-- Actions -->
      <div class="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onclick={closeModal}
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
    </div>
  </div>
{/if}
