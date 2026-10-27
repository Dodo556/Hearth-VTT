import {
  type ChatMessage,
  newRequestId,
  type Participant,
  type Roll,
  type TokenCommand,
} from "@hearth/protocol";
import { Button, ErrorMessage } from "@hearth/ui";
import { useEffect, useRef, useState } from "react";
import { t } from "../i18n/en";
import { participantLabel, Recipients, recipientNames, selectionUnavailable } from "./Recipients";
import { RollCard } from "./RollCard";
export function Chat({
  messages,
  rolls,
  participants,
  userId,
  disabled,
  send,
  participantsAvailable = true,
}: {
  messages: ChatMessage[];
  rolls: Roll[];
  participants: Participant[];
  userId: string;
  disabled: boolean;
  participantsAvailable?: boolean;
  send: (command: TokenCommand) => Promise<void>;
}) {
  const [body, setBody] = useState(""),
    [visibility, setVisibility] = useState<"public" | "whisper">("public");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [error, setError] = useState<Error | null>(null),
    [pending, setPending] = useState(false),
    [accepted, setAccepted] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const log = useRef<HTMLDivElement>(null),
    active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Replaced history arrays intentionally trigger scrolling after new snapshots.
  useEffect(() => {
    if (atBottom && log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages, rolls, atBottom]);
  const length = Array.from(body).length;
  const invalidRecipients =
    visibility === "whisper" &&
    selectionUnavailable(recipients, participants, userId, participantsAvailable);
  const items = [
    ...messages.map((message) => ({ kind: "message" as const, value: message })),
    ...rolls.map((roll) => ({ kind: "roll" as const, value: roll })),
  ].sort((a, b) => a.value.revision - b.value.revision);
  return (
    <section className="chat-panel" aria-label={t.chat}>
      <span className="eyebrow">{t.chat}</span>
      <h2>{t.chatTitle}</h2>
      <p className="muted">{t.chatHistoryHint}</p>
      <div
        className="chat-log"
        role="log"
        aria-label={t.chatHistory}
        ref={log}
        onScroll={() => {
          const el = log.current;
          if (el) setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
        }}
      >
        {!items.length && <p className="empty-note">{t.noMessages}</p>}
        {items.map((item) => (
          <div key={`${item.kind}:${item.value.id}`}>
            {item.kind === "roll" ? (
              <RollCard roll={item.value} participants={participants} chat />
            ) : (
              <article
                className={`chat-message ${item.value.visibility}`}
                data-testid="chat-message"
                data-message-id={item.value.id}
              >
                <header>
                  <strong>
                    {participantLabel(
                      { id: item.value.senderId, displayName: item.value.senderName },
                      participants,
                    )}
                  </strong>
                  <span className="roll-scope">
                    {item.value.visibility === "whisper" ? t.whisper : t.publicMessage}
                  </span>
                </header>
                {item.value.visibility === "whisper" && (
                  <small>
                    {t.messageRecipients(recipientNames(item.value.recipientIds, participants))}
                  </small>
                )}
                <p>{item.value.body}</p>
                <time dateTime={new Date(item.value.createdAt * 1000).toISOString()}>
                  {new Date(item.value.createdAt * 1000).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </article>
            )}
          </div>
        ))}
      </div>
      {!atBottom && (
        <Button type="button" onClick={() => setAtBottom(true)}>
          {t.latestMessages}
        </Button>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (disabled || pending || !body.trim() || length > 1000 || invalidRecipients) return;
          setError(null);
          setPending(true);
          setAccepted(false);
          void send({
            type: "chat.send",
            payload: {
              clientMessageId: newRequestId(),
              body,
              visibility,
              recipientIds: visibility === "whisper" ? recipients : [],
            },
          })
            .then(() => {
              if (active.current) {
                setBody("");
                setAccepted(true);
                setAtBottom(true);
              }
            })
            .catch((e: unknown) => {
              if (active.current) setError(e instanceof Error ? e : new Error(t.messageFailed));
            })
            .finally(() => {
              if (active.current) setPending(false);
            });
        }}
      >
        <label>
          {t.messageVisibility}
          <select
            aria-label={t.messageVisibility}
            value={visibility}
            disabled={pending}
            onChange={(e) => setVisibility(e.target.value as typeof visibility)}
          >
            <option value="public">{t.publicMessage}</option>
            <option value="whisper">{t.whisper}</option>
          </select>
        </label>
        {visibility === "whisper" ? (
          <>
            <Recipients
              participants={participants}
              userId={userId}
              selected={recipients}
              onChange={setRecipients}
              disabled={pending}
              available={participantsAvailable}
            />
            <p className="muted">{t.whisperPrivacy}</p>
          </>
        ) : (
          <p className="muted">{t.publicMessagePrivacy}</p>
        )}
        <label>
          {t.messageText}
          <textarea
            aria-label={t.messageText}
            value={body}
            disabled={pending}
            maxLength={2000}
            rows={3}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
        <span className={length > 1000 ? "error-message" : "muted"}>{length}/1000</span>
        <Button
          type="submit"
          className="primary full-width"
          disabled={disabled || pending || !body.trim() || length > 1000 || invalidRecipients}
        >
          {visibility === "whisper" ? t.sendWhisper : t.sendPublicMessage}
        </Button>
      </form>
      <ErrorMessage error={error} />
      {accepted && (
        <p role="status" className="muted">
          {t.messageSaved}
        </p>
      )}
    </section>
  );
}
