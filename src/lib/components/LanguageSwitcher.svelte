<script lang="ts">
  import { availableLanguageTags, languageTag } from '$lib/paraglide/runtime';
  import { setLanguageCookie } from '$lib/i18n';
  import type { AvailableLanguageTag } from '$lib/paraglide/runtime';

  function switchLang() {
    const current = languageTag();
    const next = (availableLanguageTags.find((l) => l !== current) ?? current) as AvailableLanguageTag;
    setLanguageCookie(document, next);
    window.location.reload();
  }
</script>

<button
  onclick={switchLang}
  class="w-7 h-7 rounded-md border border-border bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer uppercase"
  aria-label="Switch language"
>
  {languageTag()}
</button>
