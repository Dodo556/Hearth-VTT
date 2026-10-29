import { Button } from "@hearth/ui";
import { useState } from "react";
import { api } from "../api";

export function JournalImage({
  campaignId,
  assetId,
  title,
}: {
  campaignId: string;
  assetId: string;
  title: string;
}) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  return (
    <figure className="journal-image">
      <img
        key={attempt}
        src={`${api.asset(campaignId, assetId)}?attempt=${attempt}`}
        alt={title}
        onLoad={() => setState("ready")}
        onError={() => setState("error")}
        hidden={state === "error"}
      />
      {state === "ready" && (
        <figcaption>
          <a href={api.asset(campaignId, assetId)} target="_blank" rel="noreferrer">
            Open full image
          </a>
        </figcaption>
      )}
      {state === "loading" && <figcaption role="status">Loading handout…</figcaption>}
      {state === "error" && (
        <figcaption role="alert">
          Image unavailable. Check the connection or ask the GM to reload the page.{" "}
          <Button
            type="button"
            onClick={() => {
              setState("loading");
              setAttempt(attempt + 1);
            }}
          >
            Retry image
          </Button>
        </figcaption>
      )}
    </figure>
  );
}
