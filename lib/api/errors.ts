"use client";

import { HTTPError } from "ky";

import type { ValidationErrors } from "@/lib/api/types";

/**
 * Best-effort extraction of a user-facing error message from an Elsa API
 * failure. Reads the JSON body when present, falls back to the HTTP status,
 * and bottoms out on a generic message.
 */
export async function describeApiError(err: unknown): Promise<string> {
  if (err instanceof HTTPError) {
    try {
      const body = (await err.response.clone().json()) as {
        title?: string;
        detail?: string;
        message?: string;
        errors?: ValidationErrors;
      };
      const list = body.errors
        ? Object.entries(body.errors)
            .flatMap(([k, v]) => v.map((msg) => `${k}: ${msg}`))
            .join("; ")
        : null;
      return body.detail ?? body.title ?? body.message ?? list ?? err.response.statusText;
    } catch {
      return err.response.statusText || "Request failed.";
    }
  }
  if (err instanceof Error) return err.message;
  return "Unknown error.";
}

/** Returns the validation-error map if the failure is a 422 with Elsa's ValidationErrors. */
export async function tryExtractValidationErrors(err: unknown): Promise<ValidationErrors | null> {
  if (!(err instanceof HTTPError)) return null;
  try {
    const body = (await err.response.clone().json()) as { errors?: ValidationErrors };
    return body.errors ?? null;
  } catch {
    return null;
  }
}
