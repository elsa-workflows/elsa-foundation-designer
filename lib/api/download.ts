"use client";

/**
 * Triggers a browser download for a Blob, using the supplied filename. Falls
 * back to a timestamped default if the server didn't send a name.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Extracts the filename from a Content-Disposition header. Returns null if
 * the header is missing or the filename can't be parsed.
 */
export function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  // RFC 5987 filename*=UTF-8''…
  const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].replace(/^"|"$/g, ""));
    } catch {
      // fall through to the plain form
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1] ?? null;
}
