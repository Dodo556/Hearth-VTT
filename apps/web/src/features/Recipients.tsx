import type { Participant } from "@hearth/protocol";
import { t } from "../i18n/en";
export function selectionUnavailable(
  ids: string[],
  participants: Participant[],
  userId: string,
  available: boolean,
) {
  return (
    !available ||
    !ids.length ||
    ids.some((id) => id === userId || !participants.some((p) => p.id === id))
  );
}
// Names are not unique account identifiers; expand a stable ID prefix only for duplicates.
export function participantLabel(
  person: Pick<Participant, "id" | "displayName">,
  participants: Participant[],
) {
  const key = (name: string) => name.normalize("NFKC").trim().toLowerCase();
  if (
    !participants.some((p) => p.id !== person.id && key(p.displayName) === key(person.displayName))
  )
    return person.displayName;
  let size = 6;
  while (
    size < person.id.length &&
    participants.some((p) => p.id !== person.id && p.id.slice(0, size) === person.id.slice(0, size))
  )
    size++;
  return `${person.displayName} · ${person.id.slice(0, size)}`;
}
export function recipientNames(ids: string[], participants: Participant[]) {
  return ids
    .map((id) => {
      const person = participants.find((p) => p.id === id);
      return person ? participantLabel(person, participants) : t.unavailableParticipant;
    })
    .join(", ");
}
export function Recipients({
  participants,
  userId,
  selected,
  onChange,
  disabled,
  available = true,
}: {
  participants: Participant[];
  userId: string;
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled: boolean;
  available?: boolean;
}) {
  const missing = selected.filter((id) => !participants.some((p) => p.id === id) || id === userId);
  return (
    <fieldset className="recipient-picker" disabled={disabled}>
      <legend>{t.recipients}</legend>
      <p className="muted">{t.recipientHint}</p>
      {!available && <p role="status">{t.participantsUnavailable}</p>}
      {!!missing.length && <p role="status">{t.recipientGone}</p>}
      <div className="recipient-options">
        {participants
          .filter((p) => p.id !== userId)
          .map((p) => (
            <label key={p.id}>
              <input
                type="checkbox"
                checked={selected.includes(p.id)}
                disabled={!selected.includes(p.id) && selected.length >= 8}
                onChange={(e) =>
                  onChange(
                    e.target.checked ? [...selected, p.id] : selected.filter((id) => id !== p.id),
                  )
                }
              />
              <span>
                {participantLabel(p, participants)}
                {p.role === "dm" ? " · DM" : ""}
              </span>
            </label>
          ))}
        {missing.map((id) => (
          <label key={id}>
            <input
              type="checkbox"
              checked
              onChange={() => onChange(selected.filter((s) => s !== id))}
            />
            <span>{t.unavailableParticipant}</span>
          </label>
        ))}
      </div>
      {!participants.some((p) => p.id !== userId) && !missing.length && (
        <p className="muted">{t.noOtherParticipants}</p>
      )}
    </fieldset>
  );
}
