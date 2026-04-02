<script lang="ts">
  import '../app.css';
  import { setLanguageTag, sourceLanguageTag } from '$lib/paraglide/runtime.js';
  import { isAvailableLanguageTag, setLanguageCookie } from '$lib/i18n';

  const { data, children } = $props();

  import type { AvailableLanguageTag } from '$lib/paraglide/runtime.js';

  // Client-side: read lang from cookie or detect from browser, then sync
  if (typeof document !== 'undefined') {
    const cookieMatch = document.cookie.match(/(?:^|;\s*)lang=([^;]+)/);
    const raw = cookieMatch?.[1];

    let lang: AvailableLanguageTag;
    if (raw && isAvailableLanguageTag(raw)) {
      lang = raw;
    } else {
      const browserLang = navigator.language.split('-')[0].toLowerCase();
      lang = isAvailableLanguageTag(browserLang) ? browserLang : sourceLanguageTag;
      setLanguageCookie(document, lang);
    }

    setLanguageTag(lang);
    document.documentElement.lang = lang;
  }

  $effect(() => {
    document.documentElement.className = data.theme;
  });
</script>

{@render children()}
