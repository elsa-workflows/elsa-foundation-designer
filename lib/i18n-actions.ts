"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { LOCALE_COOKIE, SUPPORTED, type Locale } from "@/i18n/request";

/**
 * Persist the chosen locale in a cookie. The cookie is read at request time
 * by `i18n/request.ts` so subsequent renders pick up the new messages.
 */
export async function setLocale(locale: Locale): Promise<void> {
  if (!(SUPPORTED as readonly string[]).includes(locale)) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/");
}
