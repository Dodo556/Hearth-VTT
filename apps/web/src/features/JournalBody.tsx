import { Fragment, type ReactNode } from "react";

// A deliberately small grammar. Content is always React text, never HTML or URLs.
function inline(text: string): ReactNode[] {
  let offset = 0;
  return text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/u).map((part) => {
    const key = `inline-${offset}`;
    offset += part.length;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4)
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2)
      return <em key={key}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2)
      return <code key={key}>{part.slice(1, -1)}</code>;
    return <Fragment key={key}>{part}</Fragment>;
  });
}
const heading = (line: string) => /^(#{1,3}) (.+)$/u.exec(line);
const list = (line: string) => /^(- |\d{1,3}\. )(.+)$/u.exec(line);
export function JournalBody({
  body,
  format = "plain",
}: {
  body: string;
  format?: "plain" | "markdown";
}) {
  if (format !== "markdown") return <p className="journal-literal">{body}</p>;
  const lines = body.split("\n"),
    blocks: ReactNode[] = [];
  for (let i = 0; i < lines.length; ) {
    const line = lines[i] ?? "",
      h = heading(line),
      item = list(line),
      key = i;
    if (!line.trim()) {
      i++;
      continue;
    }
    if (h) {
      const children = inline(h[2] ?? "");
      blocks.push(
        (h[1] ?? "").length === 1 ? (
          <h3 key={key}>{children}</h3>
        ) : (h[1] ?? "").length === 2 ? (
          <h4 key={key}>{children}</h4>
        ) : (
          <h5 key={key}>{children}</h5>
        ),
      );
      i++;
      continue;
    }
    if (item) {
      const ordered = item[1] !== "- ",
        items: ReactNode[] = [];
      let current: RegExpExecArray | null = item;
      while (current && (current[1] !== "- ") === ordered) {
        const check = /^\[([ xX])\] (.+)$/u.exec(current[2] ?? "");
        items.push(
          <li key={i}>
            {check ? (
              <label className="journal-check">
                <input type="checkbox" disabled checked={check[1] !== " "} />
                <span>{inline(check[2] ?? "")}</span>
              </label>
            ) : (
              inline(current[2] ?? "")
            )}
          </li>,
        );
        i++;
        current = i < lines.length ? list(lines[i] ?? "") : null;
      }
      blocks.push(
        ordered ? (
          <ol key={key} start={Number.parseInt(item[1] ?? "1", 10)}>
            {items}
          </ol>
        ) : (
          <ul key={key}>{items}</ul>
        ),
      );
      continue;
    }
    const paragraph = [line];
    i++;
    while (
      i < lines.length &&
      lines[i]?.trim() &&
      !heading(lines[i] ?? "") &&
      !list(lines[i] ?? "")
    )
      paragraph.push(lines[i++] ?? "");
    blocks.push(<p key={key}>{inline(paragraph.join("\n"))}</p>);
  }
  return <div className="journal-rich">{blocks}</div>;
}
