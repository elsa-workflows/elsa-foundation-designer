import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

const LOCALE_COOKIE = "elsa_locale";
const SUPPORTED = ["en", "nl"] as const;
type Locale = (typeof SUPPORTED)[number];

function normalize(value: string | undefined): Locale {
  if (!value) return "en";
  const head = value.split(/[-_]/)[0].toLowerCase();
  return (SUPPORTED as readonly string[]).includes(head) ? (head as Locale) : "en";
}

/**
 * Server-side i18n configuration. Pulls the active locale from the
 * `elsa_locale` cookie so the language picker can switch without a route
 * prefix. Falls back to English.
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = normalize(cookieLocale);
  const messages = (await import(`../messages/${locale}.json`)).default;
  return { locale, messages };
});

export { LOCALE_COOKIE, SUPPORTED };
export type { Locale };
