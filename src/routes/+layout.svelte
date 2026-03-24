<script lang="ts">
  import '../app.css';
  import { ParaglideJS } from '@inlang/paraglide-sveltekit';
  import { i18n } from '$lib/i18n';

  const { data, children } = $props();

  $effect(() => {
    document.documentElement.className = data.theme;
  });
</script>

<ParaglideJS {i18n}>
  {@render children()}
</ParaglideJS>
