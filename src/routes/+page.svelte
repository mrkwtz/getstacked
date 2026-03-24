<script lang="ts">
  import * as m from '$lib/paraglide/messages';
</script>

<div class="min-h-screen bg-background text-foreground flex flex-col">
  <!-- Top bar -->
  <header class="border-b border-border px-6 py-4 flex items-center">
    <span class="font-extrabold text-sm tracking-tight">GETSTACKED</span>
    <div class="ml-auto flex items-center gap-3">
      <a href="/auth/login" class="text-sm text-muted-foreground hover:text-foreground transition-colors">
        {m.auth_sign_in()}
      </a>
      <a
        href="/auth/login"
        class="bg-accent text-accent-foreground text-sm font-medium px-3 py-1.5 rounded-md hover:bg-accent/90 transition-colors"
      >
        {m.get_started()}
      </a>
    </div>
  </header>

  <!-- Hero -->
  <main class="flex-1 flex flex-col items-center justify-center px-6 text-center">
    <p class="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-4">
      {m.landing_eyebrow()}
    </p>
    <h1 class="text-4xl font-bold tracking-tight leading-tight mb-4">
      {m.app_name()}
    </h1>
    <p class="text-muted-foreground text-lg max-w-sm leading-relaxed mb-8">
      {m.landing_tagline()}
    </p>
    <div class="flex gap-3">
      <a
        href="/auth/login"
        class="bg-accent text-accent-foreground font-medium px-5 py-2.5 rounded-md hover:bg-accent/90 transition-colors"
      >
        {m.get_started()}
      </a>
      <a
        href="/auth/login"
        class="border border-border text-muted-foreground font-medium px-5 py-2.5 rounded-md hover:text-foreground hover:border-foreground/30 transition-colors"
      >
        {m.auth_sign_in()}
      </a>
    </div>
  </main>
</div>
