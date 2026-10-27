import { newRequestId, type Participant, type Roll, type TokenCommand } from "@hearth/protocol";
import { Button, ErrorMessage } from "@hearth/ui";
import { useEffect, useRef, useState } from "react";
import { Recipients, selectionUnavailable } from "./Recipients";
import { RollCard, scopeNames } from "./RollCard";

type Scope = Roll["visibility"];
const labels: Record<Scope, string> = {
  public: "Roll publicly",
  gm: "Roll to DM + me",
  self: "Roll privately",
  blind: "Roll blind",
  selected: "Roll to selected participants",
};
export function Dice({
  rolls,
  disabled,
  send,
  participants = [],
  userId = "",
  participantsAvailable = true,
  preparedRoll,
}: {
  rolls: Roll[];
  disabled: boolean;
  send: (c: TokenCommand) => Promise<void>;
  participants?: Participant[];
  userId?: string;
  participantsAvailable?: boolean;
  preparedRoll?: { formula: string; sequence: number };
}) {
  const [expression, setExpression] = useState("1d20"),
    [visibility, setVisibility] = useState<Scope>("public");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [error, setError] = useState<Error | null>(null),
    [accepted, setAccepted] = useState(""),
    [pending, setPending] = useState(false);
  useEffect(() => {
    if (preparedRoll) setExpression(preparedRoll.formula);
  }, [preparedRoll]);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const unavailable =
    visibility === "selected" &&
    selectionUnavailable(recipients, participants, userId, participantsAvailable);
  const blocked = disabled || pending || unavailable;
  async function submit(text: string) {
    if (blocked) return;
    setError(null);
    setAccepted("");
    setPending(true);
    const scope = visibility;
    try {
      await send({
        type: "dice.roll",
        payload: {
          clientRollId: newRequestId(),
          expression: text,
          visibility: scope,
          recipientIds: scope === "selected" ? recipients : [],
        },
      });
      if (active.current)
        setAccepted(
          scope === "blind"
            ? "Blind roll accepted. Only the DM receives the result."
            : "Roll accepted and saved on the host.",
        );
    } catch (e) {
      if (active.current)
        setError(e instanceof Error ? e : new Error("The roll could not be completed."));
    } finally {
      if (active.current) setPending(false);
    }
  }
  return (
    <section className="dice-panel" aria-label="Dice roller">
      <span className="eyebrow">Host dice</span>
      <h2>Roll the dice.</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(expression);
        }}
      >
        <label>
          Dice expression
          <input
            aria-label="Dice expression"
            disabled={pending}
            required
            maxLength={120}
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            placeholder="2d6+3"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label>
          Roll visibility
          <select
            aria-label="Roll visibility"
            value={visibility}
            disabled={pending}
            onChange={(e) => setVisibility(e.target.value as Scope)}
          >
            {(Object.keys(scopeNames) as Scope[]).map((scope) => (
              <option key={scope} value={scope}>
                {scopeNames[scope]}
              </option>
            ))}
          </select>
        </label>
        {visibility === "selected" && (
          <Recipients
            participants={participants}
            userId={userId}
            selected={recipients}
            onChange={setRecipients}
            disabled={pending}
            available={participantsAvailable}
          />
        )}
        <p className="muted">
          {visibility === "public"
            ? "Everyone in this campaign receives the result."
            : visibility === "gm"
              ? "Only you and the DM receive the result."
              : visibility === "self"
                ? "Only your browser account receives the result, including when someone else is the DM."
                : visibility === "selected"
                  ? "Only you and the selected participants receive the result. Include the DM explicitly if needed."
                  : "Only the DM receives the result. You receive an acceptance message."}
        </p>
        <Button
          type="submit"
          className="primary full-width"
          disabled={blocked || !expression.trim()}
        >
          {labels[visibility]}
        </Button>
      </form>
      <ErrorMessage error={error} />
      <p className="dice-acceptance" role="status">
        {accepted}
      </p>
      <fieldset className="dice-tray">
        <legend>Quick rolls</legend>
        {[4, 6, 8, 10, 12, 20, 100].map((sides) => (
          <Button
            key={sides}
            disabled={blocked}
            aria-label={`Quick roll d${sides}`}
            onClick={() => {
              setExpression(`1d${sides}`);
              void submit(`1d${sides}`);
            }}
          >
            d{sides}
          </Button>
        ))}
      </fieldset>
      <p className="muted">
        Quick rolls use the selected visibility. Try 2d6+3 or (d20+4)/2. Up to100 dice,120
        characters; no advanced notation yet.
      </p>
      <h3>Recent rolls</h3>
      <p className="muted">
        Latest20 results you may read. The host keeps up to1000 per campaign. Blind results appear
        only for the DM.
      </p>
      {!rolls.length && <p className="empty-note">No visible rolls yet.</p>}
      <ol className="roll-history">
        {rolls.map((roll) => (
          <li key={roll.id}>
            <RollCard roll={roll} participants={participants} />
          </li>
        ))}
      </ol>
    </section>
  );
}
