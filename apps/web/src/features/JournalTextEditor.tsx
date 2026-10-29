import { Button } from "@hearth/ui";
import { useLayoutEffect, useRef, useState } from "react";
import { JournalBody } from "./JournalBody";
import { formatJournalSelection, type JournalStyle, journalStyles } from "./journalFormatting";
export function JournalTextEditor({
  body,
  format,
  disabled,
  onChange,
}: {
  body: string;
  format: "plain" | "markdown";
  disabled: boolean;
  onChange: (body: string, format: "plain" | "markdown") => void;
}) {
  const area = useRef<HTMLTextAreaElement>(null),
    selection = useRef<{ start: number; end: number; body: string } | null>(null);
  const [preview, setPreview] = useState(false),
    [notice, setNotice] = useState("");
  useLayoutEffect(() => {
    const next = selection.current;
    if (next && next.body === body && area.current) {
      area.current.focus();
      area.current.setSelectionRange(next.start, next.end);
      selection.current = null;
    }
  }, [body]);
  function apply(style: JournalStyle) {
    const el = area.current;
    if (!el) return;
    const next = formatJournalSelection(body, el.selectionStart, el.selectionEnd, style);
    if (!next) {
      setNotice("Formatting would exceed 1000 characters. Shorten the text first.");
      return;
    }
    setNotice("");
    selection.current = next;
    onChange(next.body, format);
  }
  return (
    <div className="journal-text-editor">
      <label>
        Text format
        <select
          aria-label="Text format"
          value={format}
          disabled={disabled}
          onChange={(e) => {
            setNotice("");
            onChange(body, e.target.value as "plain" | "markdown");
          }}
        >
          <option value="plain">Plain text</option>
          <option value="markdown">Formatted text</option>
        </select>
      </label>
      <p className="muted">
        {format === "plain"
          ? "Plain text stays literal. Choose Formatted text to use formatting markers."
          : "Headings, bold, italic, code, flat lists and checklists. HTML, links and embedded images stay literal."}
      </p>
      <div className="journal-format-actions">
        <Button type="button" aria-pressed={!preview} onClick={() => setPreview(false)}>
          Edit source
        </Button>
        <Button type="button" aria-pressed={preview} onClick={() => setPreview(true)}>
          Preview formatting
        </Button>
      </div>
      {!preview && format === "markdown" && (
        <fieldset className="journal-format-actions">
          <legend>Text formatting</legend>
          {journalStyles.map((style) => (
            <Button key={style} type="button" disabled={disabled} onClick={() => apply(style)}>
              {style}
            </Button>
          ))}
        </fieldset>
      )}
      {preview ? (
        <section className="journal-preview" aria-label="Journal preview">
          <JournalBody body={body} format={format} />
        </section>
      ) : (
        <label>
          Page text
          <textarea
            ref={area}
            aria-label="Page text"
            value={body}
            rows={10}
            maxLength={2000}
            disabled={disabled}
            onChange={(e) => {
              if (Array.from(e.target.value).length > 1000) {
                setNotice("Use up to 1000 characters. Your previous draft is kept.");
                return;
              }
              setNotice("");
              onChange(e.target.value, format);
            }}
          />
        </label>
      )}
      <span className="muted">
        {Array.from(body).length}/1000 characters, including formatting markers
      </span>
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}
