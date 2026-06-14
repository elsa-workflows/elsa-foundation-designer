"use client";

import Editor, { type OnMount } from "@monaco-editor/react";
import { useTheme } from "next-themes";
import { useCallback } from "react";

export type MonacoLanguage =
  | "javascript"
  | "csharp"
  | "python"
  | "json"
  | "liquid"
  | "sql"
  | "plaintext";

type Props = {
  value: string;
  onChange: (next: string) => void;
  language: MonacoLanguage;
  readOnly?: boolean;
  /** CSS height (px number or string). Defaults to 200 px. */
  height?: number | string;
  /** Whether to show the gutter line numbers. */
  lineNumbers?: boolean;
};

// Liquid is registered once at the Monaco level, not per editor instance.
let liquidRegistered = false;

/**
 * Register a minimal Liquid tokenizer the first time any editor mounts so
 * `{% if %}` / `{{ foo }}` constructs get keyword + delimiter highlighting.
 * Mirrors the Blazor designer's Liquid mode without pulling in a heavy
 * grammar package.
 */
function registerLiquid(monaco: Parameters<OnMount>[1]): void {
  if (liquidRegistered) return;
  liquidRegistered = true;
  monaco.languages.register({ id: "liquid" });
  monaco.languages.setMonarchTokensProvider("liquid", {
    defaultToken: "",
    tokenizer: {
      root: [
        [/\{%/, { token: "delimiter.tag", next: "@tag" }],
        [/\{\{/, { token: "delimiter.output", next: "@output" }],
        [/[^{]+/, ""],
        [/\{/, ""],
      ],
      tag: [
        [/%\}/, { token: "delimiter.tag", next: "@pop" }],
        [
          /\b(if|elsif|else|endif|for|endfor|in|case|when|endcase|capture|endcapture|assign|unless|endunless|comment|endcomment|cycle|include|render|break|continue|paginate|endpaginate|tablerow|endtablerow|raw|endraw|liquid)\b/,
          "keyword",
        ],
        [/"[^"]*"|'[^']*'/, "string"],
        [/\b\d+(\.\d+)?\b/, "number"],
        [/[a-zA-Z_][\w-]*/, "identifier"],
        [/[|.:=<>!]+/, "operator"],
        [/\s+/, ""],
      ],
      output: [
        [/\}\}/, { token: "delimiter.output", next: "@pop" }],
        [/"[^"]*"|'[^']*'/, "string"],
        [/\b\d+(\.\d+)?\b/, "number"],
        [/[a-zA-Z_][\w-]*/, "identifier"],
        [/[|.:=<>!]+/, "operator"],
        [/\s+/, ""],
      ],
    },
  });
}

/**
 * Monaco-backed code editor. Matches the Blazor designer's
 * `BlazorMonaco.Editor.StandaloneCodeEditor` so JS / JSON / Liquid editing
 * gets the same affordances (autocomplete, format-on-paste for JSON, inline
 * validation, theme tracking).
 *
 * The component is client-only; `@monaco-editor/react` loads Monaco itself
 * lazily, so the initial route bundle stays small.
 */
export function MonacoCodeEditor({
  value,
  onChange,
  language,
  readOnly = false,
  height = 200,
  lineNumbers = true,
}: Props) {
  const { resolvedTheme } = useTheme();

  const handleMount: OnMount = useCallback(
    (_editor, monaco) => {
      registerLiquid(monaco);
    },
    [],
  );

  return (
    <Editor
      value={value}
      language={language === "plaintext" ? "plaintext" : language}
      theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
      onChange={(next) => onChange(next ?? "")}
      onMount={handleMount}
      height={typeof height === "number" ? `${height}px` : height}
      options={{
        readOnly,
        minimap: { enabled: false },
        fontSize: 12,
        lineNumbers: lineNumbers ? "on" : "off",
        scrollBeyondLastLine: false,
        wordWrap: "on",
        tabSize: 2,
        automaticLayout: true,
        renderLineHighlight: readOnly ? "none" : "line",
        folding: true,
        formatOnPaste: language === "json",
        formatOnType: false,
        // Suggestion behaviour: outside of JSON we don't ship a real
        // language server, so Monaco's word-based + snippet suggestions
        // popped up mid-typing and auto-accepted on space / Enter —
        // turning "public void" into "public. void.". Keep suggestions
        // opt-in (Ctrl+Space) everywhere except JSON, which benefits
        // from schema-aware completion. Inline ghost text, parameter
        // hints and snippet expansion are also disabled because none
        // are wired to a real language service.
        quickSuggestions: language === "json",
        suggestOnTriggerCharacters: language === "json",
        acceptSuggestionOnCommitCharacter: false,
        acceptSuggestionOnEnter: language === "json" ? "on" : "off",
        wordBasedSuggestions: language === "json" ? "currentDocument" : "off",
        tabCompletion: "off",
        snippetSuggestions: "none",
        inlineSuggest: { enabled: false },
        parameterHints: { enabled: false },
        suggest: {
          showWords: language === "json",
          showSnippets: false,
          showKeywords: language === "json",
          showFunctions: language === "json",
          showClasses: language === "json",
          showVariables: language === "json",
        },
        scrollbar: {
          alwaysConsumeMouseWheel: false,
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10,
        },
        padding: { top: 6, bottom: 6 },
      }}
      loading={
        <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
          Loading editor…
        </div>
      }
    />
  );
}
