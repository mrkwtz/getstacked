<script lang="ts">
  import * as m from '$lib/paraglide/messages';
</script>

<div class="min-h-screen flex flex-col items-center justify-center bg-gray-950 text-white">
  <h1 class="text-4xl font-bold mb-4">{m.app_name()}</h1>
  <p class="text-gray-400 mb-8 text-lg">{m.landing_tagline()}</p>
  <a
    href="/auth/login"
    class="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium transition-colors"
  >
    {m.get_started()}
  </a>
</div>
