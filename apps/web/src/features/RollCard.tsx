import type { Participant, Roll } from "@hearth/protocol";
import { participantLabel, recipientNames } from "./Recipients";
export const scopeNames: Record<Roll["visibility"], string> = {
  public: "Public",
  gm: "DM + me",
  self: "Only me",
  blind: "Blind · DM only",
  selected: "Selected participants",
};
export function RollCard({
  roll,
  participants = [],
  chat = false,
}: {
  roll: Roll;
  participants?: Participant[];
  chat?: boolean;
}) {
  const rounded = Number(roll.total.toFixed(4));
  return (
    <article
      className="saved-roll"
      data-testid={chat ? "chat-roll-card" : "roll-result"}
      data-roll-id={roll.id}
    >
      <header>
        <strong>
          {participantLabel({ id: roll.rollerId, displayName: roll.rollerName }, participants)}
        </strong>
        <span className="roll-scope">{scopeNames[roll.visibility]}</span>
      </header>
      {roll.visibility === "selected" && (
        <p className="roll-breakdown">
          To {recipientNames(roll.recipientIds, participants)} + roller
        </p>
      )}
      <div className="roll-summary">
        <code>{roll.normalizedExpression}</code>
        <output title={String(roll.total)} aria-label="Roll total">
          {rounded === roll.total ? "" : "≈ "}
          {rounded}
        </output>
      </div>
      {roll.dice.map((dice, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: Immutable saved terms never reorder.
        <p className="roll-breakdown" key={`${i}:${dice.sides}`}>
          {dice.count}d{dice.sides}: [{dice.faces.join(", ")}] = {dice.subtotal}
        </p>
      ))}
      {!roll.dice.length && <p className="roll-breakdown">Arithmetic only</p>}
      <time dateTime={new Date(roll.createdAt * 1000).toISOString()}>
        {new Date(roll.createdAt * 1000).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </time>
    </article>
  );
}
