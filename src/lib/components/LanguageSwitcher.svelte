<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { i18n } from '$lib/i18n';
  import { availableLanguageTags, languageTag } from '$lib/paraglide/runtime';

  function switchLang() {
    const current = languageTag();
    const next = availableLanguageTags.find((l) => l !== current) ?? current;
    const canonical = i18n.route(page.url.pathname);
    const localized = i18n.resolveRoute(canonical, next);
    goto(localized);
  }
</script>

<button
  onclick={switchLang}
  class="w-7 h-7 rounded-md border border-border bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer uppercase"
  aria-label="Switch language"
>
  {languageTag()}
</button>
