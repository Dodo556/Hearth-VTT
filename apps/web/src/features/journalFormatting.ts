export type JournalStyle =
  | "Bold"
  | "Italic"
  | "Code"
  | "Heading"
  | "Bullet list"
  | "Numbered list"
  | "Checklist";
export const journalStyles: JournalStyle[] = [
  "Bold",
  "Italic",
  "Code",
  "Heading",
  "Bullet list",
  "Numbered list",
  "Checklist",
];
export function formatJournalSelection(
  body: string,
  start: number,
  end: number,
  style: JournalStyle,
) {
  start = Math.max(0, Math.min(body.length, start));
  end = Math.max(start, Math.min(body.length, end));
  let text: string, selectStart: number, selectEnd: number;
  if (style === "Bold" || style === "Italic" || style === "Code") {
    const mark = style === "Bold" ? "**" : style === "Italic" ? "*" : "`",
      selected = body.slice(start, end) || "text";
    text = body.slice(0, start) + mark + selected + mark + body.slice(end);
    selectStart = start + mark.length;
    selectEnd = selectStart + selected.length;
  } else {
    const from = start === 0 ? 0 : body.lastIndexOf("\n", start - 1) + 1;
    const next = body.indexOf("\n", end),
      to = next < 0 ? body.length : next;
    const lines = body
      .slice(from, to)
      .split("\n")
      .map(
        (line, i) =>
          (style === "Heading"
            ? "# "
            : style === "Bullet list"
              ? "- "
              : style === "Numbered list"
                ? `${i + 1}. `
                : "- [ ] ") + line,
      )
      .join("\n");
    text = body.slice(0, from) + lines + body.slice(to);
    selectStart = from;
    selectEnd = from + lines.length;
  }
  return Array.from(text).length <= 1000
    ? { body: text, start: selectStart, end: selectEnd }
    : null;
}
