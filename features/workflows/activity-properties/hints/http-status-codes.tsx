"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { HintContext } from "@/features/workflows/activity-properties/hint-context";
import { InputRow } from "@/features/workflows/activity-properties/input-row";
import {
  readWrappedInput,
  withLiteralValue,
  withSyntax,
} from "@/features/workflows/activity-properties/input-value";
import { SyntaxEditor } from "@/features/workflows/activity-properties/syntax-editor";

/**
 * `http-status-codes` UIHint — quick-pick dropdown of common HTTP status
 * codes paired with a free-form numeric input. Stored as a literal number on
 * the input. Mirrors the Blazor `HttpStatusCodes` picker.
 */
export function HttpStatusCodesHint({ ctx }: { ctx: HintContext }) {
  const value = readWrappedInput(ctx.activity as Record<string, unknown>, ctx.descriptor);
  const literal = value.expression?.value;
  const numeric =
    typeof literal === "number"
      ? String(literal)
      : typeof literal === "string"
        ? literal
        : "";

  return (
    <InputRow
      descriptor={ctx.descriptor}
      wrappedValue={value}
      onSyntaxChange={(s) => ctx.setRaw(withSyntax(value, s))}
      readOnly={ctx.readOnly}
    >
      <SyntaxEditor
        ctx={ctx}
        renderLiteral={() => (
          <div className="flex gap-1">
            <Input
              type="number"
              inputMode="numeric"
              min={100}
              max={599}
              value={numeric}
              readOnly={ctx.readOnly}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "") {
                  ctx.setRaw(withLiteralValue(value, null));
                  return;
                }
                const parsed = Number.parseInt(v, 10);
                ctx.setRaw(withLiteralValue(value, Number.isFinite(parsed) ? parsed : v));
              }}
              className="w-24"
            />
            <Select
              items={STATUS_ITEMS}
              value={numeric}
              onValueChange={(v) => v && ctx.setRaw(withLiteralValue(value, Number.parseInt(v, 10)))}
              disabled={ctx.readOnly}
            >
              <SelectTrigger size="sm" className="flex-1">
                <SelectValue placeholder="Common codes…" />
              </SelectTrigger>
              <SelectContent>
                {GROUPS.map((g) => (
                  <SelectGroup key={g.label}>
                    <SelectLabel>{g.label}</SelectLabel>
                    {g.codes.map((c) => (
                      <SelectItem key={c.code} value={String(c.code)}>
                        <span className="font-mono">{c.code}</span>
                        <span className="ml-2 text-muted-foreground">{c.text}</span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      />
    </InputRow>
  );
}

/** Flat `value → "code text"` map. base-ui uses this to label the trigger. */
const STATUS_ITEMS: Record<string, string> = {};

const GROUPS: { label: string; codes: { code: number; text: string }[] }[] = [
  {
    label: "2xx — success",
    codes: [
      { code: 200, text: "OK" },
      { code: 201, text: "Created" },
      { code: 202, text: "Accepted" },
      { code: 204, text: "No Content" },
    ],
  },
  {
    label: "3xx — redirection",
    codes: [
      { code: 301, text: "Moved Permanently" },
      { code: 302, text: "Found" },
      { code: 304, text: "Not Modified" },
    ],
  },
  {
    label: "4xx — client error",
    codes: [
      { code: 400, text: "Bad Request" },
      { code: 401, text: "Unauthorized" },
      { code: 403, text: "Forbidden" },
      { code: 404, text: "Not Found" },
      { code: 409, text: "Conflict" },
      { code: 422, text: "Unprocessable Entity" },
      { code: 429, text: "Too Many Requests" },
    ],
  },
  {
    label: "5xx — server error",
    codes: [
      { code: 500, text: "Internal Server Error" },
      { code: 502, text: "Bad Gateway" },
      { code: 503, text: "Service Unavailable" },
      { code: 504, text: "Gateway Timeout" },
    ],
  },
];

for (const g of GROUPS) {
  for (const c of g.codes) STATUS_ITEMS[String(c.code)] = `${c.code} ${c.text}`;
}
