import {
  applyEvent,
  CommandFrameSchema,
  type MapPing,
  newRequestId,
  PingFrameSchema,
  type Scene,
  ServerFrameSchema,
  type TokenCommand,
} from "@hearth/protocol";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

type Status = "connecting" | "live" | "reconnecting" | "denied";
type Pending = {
  frame: ReturnType<typeof CommandFrameSchema.parse>;
  resolve: () => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};
export function useCampaignStream(id: string, enabled: boolean) {
  const client = useQueryClient();
  const [status, setStatus] = useState<Status>("connecting");
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const [pings, setPings] = useState<MapPing[]>([]);
  const socket = useRef<WebSocket | null>(null);
  const revision = useRef(0);
  const live = useRef(false);
  const pending = useRef<Pending | null>(null);
  const lastPingAt = useRef<number | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let attempt = 0;
    let stream = "";
    let retry: ReturnType<typeof setTimeout>;
    let handshake: ReturnType<typeof setTimeout>;
    const pingTimers = new Set<ReturnType<typeof setTimeout>>();
    const clearPings = () => {
      for (const timer of pingTimers) clearTimeout(timer);
      pingTimers.clear();
      setPings([]);
    };
    live.current = false;
    setBusy(false);
    setStatus("connecting");
    const clearProjection = () => {
      client.setQueryData(["scenes", id], { schemaVersion: 1, scenes: [] });
      client.setQueryData(["journals", id], { schemaVersion: 1, journals: [] });
      client.setQueryData(["actors", id], { schemaVersion: 1, actors: [] });
      client.setQueryData(["rolls", id], { schemaVersion: 1, rolls: [] });
      client.setQueryData(["chat", id], { schemaVersion: 1, messages: [] });
      client.setQueryData(["combat", id], { schemaVersion: 1, encounter: null });
    };
    function connect() {
      if (stopped) return;
      if (!navigator.onLine) {
        retry = setTimeout(connect, 1000);
        return;
      }
      const url = new URL(`/api/campaigns/${id}/ws`, location.href);
      url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(url, "hearth.v1");
      lastPingAt.current = null;
      let hasSnapshot = false;
      socket.current = ws;
      handshake = setTimeout(() => ws.close(), 8000);
      ws.onopen = () =>
        ws.send(
          JSON.stringify({ kind: "hello", schemaVersion: 1, lastRevision: revision.current }),
        );
      ws.onmessage = (event) => {
        if (stopped || socket.current !== ws) return;
        let parsed: ReturnType<typeof ServerFrameSchema.safeParse>;
        try {
          parsed = ServerFrameSchema.safeParse(JSON.parse(event.data));
        } catch {
          ws.close();
          return;
        }
        if (!parsed.success) {
          setError(new Error("The host sent an unsupported update. Reconnecting…"));
          ws.close();
          return;
        }
        const frame = parsed.data;
        if (frame.kind === "snapshot") {
          const initial = !hasSnapshot;
          hasSnapshot = true;
          clearTimeout(handshake);
          revision.current = frame.revision;
          stream = frame.streamId;
          client.setQueryData(["scenes", id], { schemaVersion: 1, scenes: frame.scenes });
          client.setQueryData(["journals", id], { schemaVersion: 1, journals: frame.journals });
          client.setQueryData(["actors", id], { schemaVersion: 1, actors: frame.actors });
          client.setQueryData(["rolls", id], { schemaVersion: 1, rolls: frame.rolls });
          client.setQueryData(["chat", id], { schemaVersion: 1, messages: frame.messages });
          client.setQueryData(["combat", id], { schemaVersion: 1, encounter: frame.encounter });
          live.current = true;
          attempt = 0;
          setStatus("live");
          if (initial && pending.current) ws.send(JSON.stringify(pending.current.frame));
        } else if (frame.kind === "ping") {
          if (!hasSnapshot) return;
          setPings((previous) => [...previous.slice(-19), frame]);
          const timer = setTimeout(() => {
            pingTimers.delete(timer);
            setPings((previous) => previous.filter((ping) => ping.pingId !== frame.pingId));
          }, 3000);
          pingTimers.add(timer);
        } else if (frame.kind === "event") {
          if (frame.streamId !== stream || frame.revision !== revision.current + 1) {
            ws.close();
            return;
          }
          client.setQueryData<{ schemaVersion: number; scenes: Scene[] }>(["scenes", id], (old) =>
            old ? { ...old, scenes: applyEvent(old.scenes, frame) } : old,
          );
          revision.current = frame.revision;
        } else if (frame.kind === "ack" || frame.kind === "error") {
          const work = pending.current;
          if (
            work &&
            (frame.requestId === work.frame.requestId ||
              (frame.kind === "error" && frame.requestId === null))
          ) {
            pending.current = null;
            clearTimeout(work.timer);
            setBusy(false);
            if (frame.kind === "ack") work.resolve();
            else {
              const failure = new Error(frame.error.message);
              setError(failure);
              work.reject(failure);
            }
          } else if (frame.kind === "error") setError(new Error(frame.error.message));
        } else if (frame.kind === "closing") {
          if (frame.code === "ACCESS_REVOKED") {
            stopped = true;
            clearProjection();
            setStatus("denied");
            setError(new Error("This campaign is unavailable. Your session or access has ended."));
            if (pending.current) {
              clearTimeout(pending.current.timer);
              pending.current.reject(new Error("Access ended."));
              pending.current = null;
              setBusy(false);
            }
          }
          ws.close();
        }
      };
      ws.onclose = () => {
        if (socket.current !== ws) return;
        clearTimeout(handshake);
        live.current = false;
        clearPings();
        if (stopped) return;
        setStatus("reconnecting");
        retry = setTimeout(connect, Math.min(8000, 500 * 2 ** attempt++) + Math.random() * 250);
      };
      // Handshake errors also emit close; retries remain bounded and cancellable.
      ws.onerror = () => ws.close();
    }
    const offline = () => {
      if (stopped) return;
      live.current = false;
      setStatus("reconnecting");
      clearTimeout(retry);
      socket.current?.close();
    };
    const online = () => {
      clearTimeout(retry);
      if (!stopped && socket.current?.readyState !== WebSocket.OPEN) connect();
    };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    connect();
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      stopped = true;
      live.current = false;
      clearTimeout(retry);
      clearTimeout(handshake);
      clearPings();
      socket.current?.close();
      socket.current = null;
      if (pending.current) {
        clearTimeout(pending.current.timer);
        pending.current.reject(new Error("The table was closed."));
        pending.current = null;
      }
      setBusy(false);
    };
  }, [client, id, enabled]);
  const send = useCallback((command: TokenCommand) => {
    if (!live.current || socket.current?.readyState !== WebSocket.OPEN || pending.current)
      return Promise.reject(new Error("Wait for the live connection and any pending change."));
    setError(null);
    const parsed = CommandFrameSchema.safeParse({
      kind: "command",
      schemaVersion: 1,
      requestId: newRequestId(),
      baseRevision: revision.current,
      command,
    });
    if (!parsed.success) {
      const failure = new Error("Check the name, IDs and numeric fields before saving.");
      setError(failure);
      return Promise.reject(failure);
    }
    const frame = parsed.data;
    setBusy(true);
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.current = null;
        setBusy(false);
        const failure = new Error(
          "Confirmation timed out. Reconnect and review the saved position before retrying.",
        );
        setError(failure);
        reject(failure);
      }, 15000);
      pending.current = { frame, resolve, reject, timer };
      socket.current?.send(JSON.stringify(frame));
    });
  }, []);
  const ping = useCallback((sceneId: string, x: number, y: number) => {
    if (!live.current || socket.current?.readyState !== WebSocket.OPEN || pending.current)
      return false;
    const frame = PingFrameSchema.safeParse({ kind: "ping", schemaVersion: 1, sceneId, x, y });
    if (!frame.success) return false;
    const now = performance.now();
    if (lastPingAt.current !== null && now - lastPingAt.current < 500) return false;
    socket.current.send(JSON.stringify(frame.data));
    lastPingAt.current = now;
    return true;
  }, []);
  return { status, error, busy, send, ping, pings };
}
