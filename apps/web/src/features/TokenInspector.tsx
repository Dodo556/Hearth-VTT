import type { Actor, Token, TokenCommand } from "@hearth/protocol";
import { Button } from "@hearth/ui";
import { useEffect, useState } from "react";
import { t } from "../i18n/en";
import { TokenVitals } from "./TokenVitals";

type Props = {
  section: "details" | "vitals";
  onSection: (section: "details" | "vitals") => void;
  token: Token;
  dm: boolean;
  disabled: boolean;
  width: number;
  height: number;
  actors: Actor[];
  onOpenActor: (id: string) => void;
  players: { id: string; displayName: string; role: string }[];
  send: (command: TokenCommand) => Promise<void>;
};
export function TokenInspector({
  token,
  section,
  onSection,
  dm,
  disabled,
  width,
  height,
  players,
  actors,
  onOpenActor,
  send,
}: Props) {
  const [x, setX] = useState(String(token.x));
  const [y, setY] = useState(String(token.y));
  useEffect(() => {
    setX(String(token.x));
    setY(String(token.y));
  }, [token.x, token.y]);
  const run = (command: TokenCommand) => {
    void send(command).catch(() => {});
  };
  return (
    <section className="token-inspector" aria-label={t.tokenDetails}>
      <fieldset className="token-inspector-tabs" aria-label="Token control section">
        <button
          type="button"
          aria-pressed={section === "vitals"}
          onClick={() => onSection("vitals")}
        >
          Health & status
        </button>
        <button
          type="button"
          aria-pressed={section === "details"}
          onClick={() => onSection("details")}
        >
          Position & permissions
        </button>
      </fieldset>
      <div hidden={section !== "vitals"}>
        <TokenVitals token={token} dm={dm} disabled={disabled} send={send} />
      </div>
      <div hidden={section !== "details"}>
        <h3>{token.name}</h3>
        <p className="muted">
          {t.position}:{" "}
          <output data-testid="token-position">
            {token.x}, {token.y}
          </output>
        </p>
        {token.actorId && (
          <Button
            onClick={() => {
              if (token.actorId) onOpenActor(token.actorId);
            }}
          >
            {t.openSheet}
          </Button>
        )}
        {dm && (
          <>
            <label>
              {t.linkedActor}
              <select
                aria-label={t.linkedActor}
                value={token.actorId ?? ""}
                disabled={disabled}
                onChange={(e) =>
                  run({
                    type: "token.link",
                    payload: { tokenId: token.id, actorId: e.target.value || null },
                  })
                }
              >
                <option value="">{t.independentToken}</option>
                {actors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            {token.actorId ? (
              <p className="muted">{t.actorControlHint}</p>
            ) : (
              <label>
                {t.controlledBy}
                <select
                  aria-label={t.controlledBy}
                  value={token.controllerUserId ?? ""}
                  disabled={disabled}
                  onChange={(e) =>
                    run({
                      type: "token.assign",
                      payload: { tokenId: token.id, userId: e.target.value || null },
                    })
                  }
                >
                  <option value="">{t.dmControls}</option>
                  {players
                    .filter((player) => player.role === "player")
                    .map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.displayName}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <label>
              {t.tokenVisibility}
              <select
                aria-label={t.tokenVisibility}
                value={token.visibility}
                disabled={disabled}
                onChange={(e) =>
                  run({
                    type: "token.visibility",
                    payload: { tokenId: token.id, visibility: e.target.value as "shared" | "dm" },
                  })
                }
              >
                <option value="shared">{t.shared}</option>
                <option value="dm">{t.dmOnly}</option>
              </select>
            </label>
          </>
        )}
        {token.canMove ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run({
                type: "token.move",
                payload: { tokenId: token.id, x: Number(x), y: Number(y) },
              });
            }}
          >
            <div className="token-coordinates">
              <label>
                {t.tokenX}
                <input
                  aria-label={t.tokenX}
                  type="number"
                  required
                  min={token.size / 2}
                  max={width - token.size / 2}
                  step="any"
                  value={x}
                  onChange={(e) => setX(e.target.value)}
                  disabled={disabled}
                />
              </label>
              <label>
                {t.tokenY}
                <input
                  aria-label={t.tokenY}
                  type="number"
                  required
                  min={token.size / 2}
                  max={height - token.size / 2}
                  step="any"
                  value={y}
                  onChange={(e) => setY(e.target.value)}
                  disabled={disabled}
                />
              </label>
            </div>
            <Button type="submit" disabled={disabled}>
              {t.moveToken}
            </Button>
            <p className="muted">{t.moveHint}</p>
          </form>
        ) : (
          <p className="notice">{t.unassignedToken}</p>
        )}
      </div>
    </section>
  );
}
