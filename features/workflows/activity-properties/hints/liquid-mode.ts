import { StreamLanguage, type StreamParser } from "@codemirror/language";

/**
 * A tiny Liquid stream parser. Handles the two delimiters that matter for
 * Elsa workflow expressions:
 *
 *   {% tag args %}   — control flow / activity tags
 *   {{ output }}     — variable / expression output
 *
 * Everything else is plain text. We don't try to parse Liquid filters or
 * tag-specific arguments; that's out of scope for an inline editor and
 * better left to the server's actual Liquid parser.
 */
type State = {
  context: "text" | "tag" | "output";
};

const parser: StreamParser<State> = {
  startState: () => ({ context: "text" }),
  token(stream, state) {
    if (state.context === "text") {
      if (stream.match("{%")) {
        state.context = "tag";
        return "keyword";
      }
      if (stream.match("{{")) {
        state.context = "output";
        return "keyword";
      }
      // Eat until the next opening delimiter (or end of line).
      while (!stream.eol()) {
        if (stream.peek() === "{") {
          const ahead = stream.string.slice(stream.pos, stream.pos + 2);
          if (ahead === "{%" || ahead === "{{") return null;
        }
        stream.next();
      }
      return null;
    }

    // Inside {% %} or {{ }}
    const closing = state.context === "tag" ? "%}" : "}}";
    if (stream.match(closing)) {
      state.context = "text";
      return "keyword";
    }
    if (stream.match(/^"([^"\\]|\\.)*"/)) return "string";
    if (stream.match(/^'([^'\\]|\\.)*'/)) return "string";
    if (stream.match(/^[0-9]+(\.[0-9]+)?/)) return "number";
    if (stream.match(/^[a-zA-Z_][a-zA-Z0-9_.\-]*/)) return "variableName";
    if (stream.match(/^\|/)) return "operator";
    if (stream.match(/^[=<>!:+\-*/%]+/)) return "operator";
    stream.next();
    return null;
  },
};

export const liquid = () => StreamLanguage.define(parser);
