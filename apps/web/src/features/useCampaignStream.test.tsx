// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { useCampaignStream } from "./useCampaignStream";

class Socket {
  static OPEN = 1;
  static instances: Socket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];
  constructor() {
    Socket.instances.push(this);
  }
  send(value: string) {
    this.sent.push(value);
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  snapshot() {
    this.readyState = 1;
    this.onopen?.();
    this.onmessage?.({
      data: JSON.stringify({
        kind: "snapshot",
        schemaVersion: 1,
        streamId: "8f834642-e1a2-42f2-9c5b-a80b91991344",
        revision: 0,
        role: "dm",
        scenes: [],
        journals: [],
        serverTime: 0,
      }),
    });
  }
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  Socket.instances = [];
});
it("reenables edits after a pending command is interrupted by an authorization poll error", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", Socket);
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  const { result, rerender } = renderHook(({ enabled }) => useCampaignStream("campaign", enabled), {
    initialProps: { enabled: true },
    wrapper,
  });
  act(() => Socket.instances.at(-1)?.snapshot());
  expect(result.current.status).toBe("live");
  let work: Promise<void> | undefined;
  act(() => {
    work = result.current.send({
      type: "token.move",
      payload: { tokenId: "8f834642-e1a2-42f2-9c5b-a80b91991344", x: 30, y: 30 },
    });
    void work.catch(() => {});
  });
  expect(result.current.busy).toBe(true);
  rerender({ enabled: false });
  await expect(work).rejects.toThrow("closed");
  rerender({ enabled: true });
  act(() => Socket.instances.at(-1)?.snapshot());
  expect(result.current.status).toBe("live");
  expect(result.current.busy).toBe(false);
});

it("rejects invalid authoring input without leaving the table busy", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", Socket);
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  const { result } = renderHook(() => useCampaignStream("campaign", true), { wrapper });
  act(() => Socket.instances.at(-1)?.snapshot());
  await act(async () => {
    await expect(
      Promise.resolve().then(() =>
        result.current.send({
          type: "scene.create",
          payload: {
            sceneId: "8f834642-e1a2-42f2-9c5b-a80b91991344",
            name: "A\u0001B",
            assetId: "amber-map",
            gridSize: 60,
          },
        }),
      ),
    ).rejects.toThrow();
  });
  expect(result.current.busy).toBe(false);
  expect(result.current.error).toBeInstanceOf(Error);
});

it("rejects pending work immediately on an uncorrelated host protocol error", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", Socket);
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  const { result } = renderHook(() => useCampaignStream("camp", true), { wrapper });
  act(() => Socket.instances.at(-1)?.snapshot());
  let work: Promise<void> | undefined;
  act(() => {
    work = result.current.send({
      type: "token.move",
      payload: { tokenId: "8f834642-e1a2-42f2-9c5b-a80b91991344", x: 90, y: 90 },
    });
    void work.catch(() => {});
  });
  act(() =>
    Socket.instances.at(-1)?.onmessage?.({
      data: JSON.stringify({
        kind: "error",
        schemaVersion: 1,
        requestId: null,
        error: { code: "VALIDATION_FAILED", message: "Unsupported live frame." },
      }),
    }),
  );
  expect(result.current.busy).toBe(false);
  await expect(work).rejects.toThrow("Unsupported live frame");
});

it("replaces private roll history on snapshots and clears it when access ends", () => {
  vi.stubGlobal("WebSocket", Socket);
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  renderHook(() => useCampaignStream("camp", true), { wrapper });
  const roll = {
    id: "8f834642-e1a2-42f2-9c5b-a80b91991344",
    rollerId: "alice",
    rollerName: "Alice",
    expression: "d6",
    normalizedExpression: "1d6",
    visibility: "self",
    recipientIds: [],
    createdAt: 1,
    revision: 1,
    total: 3,
    dice: [{ count: 1, sides: 6, faces: [3], subtotal: 3 }],
  };
  act(() => {
    Socket.instances.at(-1)?.snapshot();
    Socket.instances.at(-1)?.onmessage?.({
      data: JSON.stringify({
        kind: "snapshot",
        schemaVersion: 1,
        streamId: roll.id,
        revision: 1,
        role: "player",
        scenes: [],
        journals: [],
        actors: [],
        rolls: [roll],
        serverTime: 1,
      }),
    });
  });
  expect(client.getQueryData(["rolls", "camp"])).toEqual({ schemaVersion: 1, rolls: [roll] });
  act(() =>
    Socket.instances.at(-1)?.onmessage?.({
      data: JSON.stringify({ kind: "closing", schemaVersion: 1, code: "ACCESS_REVOKED" }),
    }),
  );
  expect(client.getQueryData(["rolls", "camp"])).toEqual({ schemaVersion: 1, rolls: [] });
});

it("replaces whisper history on snapshots and clears it when access ends", () => {
  vi.stubGlobal("WebSocket", Socket);
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  renderHook(() => useCampaignStream("camp", true), { wrapper });
  const id = "8f834642-e1a2-42f2-9c5b-a80b91991344";
  const message = {
    id,
    senderId: "alice",
    senderName: "Alice",
    body: "Private text",
    visibility: "whisper",
    recipientIds: [id],
    createdAt: 1,
    revision: 1,
  };
  act(() => {
    Socket.instances.at(-1)?.snapshot();
    Socket.instances.at(-1)?.onmessage?.({
      data: JSON.stringify({
        kind: "snapshot",
        schemaVersion: 1,
        streamId: id,
        revision: 1,
        role: "player",
        scenes: [],
        journals: [],
        actors: [],
        rolls: [],
        messages: [message],
        serverTime: 1,
      }),
    });
  });
  expect(client.getQueryData(["chat", "camp"])).toEqual({ schemaVersion: 1, messages: [message] });
  act(() =>
    Socket.instances.at(-1)?.onmessage?.({
      data: JSON.stringify({ kind: "closing", schemaVersion: 1, code: "ACCESS_REVOKED" }),
    }),
  );
  expect(client.getQueryData(["chat", "camp"])).toEqual({ schemaVersion: 1, messages: [] });
});

it("sends transient pings and removes received rings without changing the campaign revision", () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", Socket);
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  const { result } = renderHook(() => useCampaignStream("campaign", true), { wrapper });
  const id = "8f834642-e1a2-42f2-9c5b-a80b91991344";
  act(() => Socket.instances.at(-1)?.snapshot());
  act(() => result.current.ping(id, 121, 181));
  expect(JSON.parse(Socket.instances.at(-1)?.sent.at(-1) ?? "{}")).toEqual({
    kind: "ping",
    schemaVersion: 1,
    sceneId: id,
    x: 121,
    y: 181,
  });
  act(() =>
    Socket.instances.at(-1)?.onmessage?.({
      data: JSON.stringify({
        kind: "ping",
        schemaVersion: 1,
        pingId: id,
        sceneId: id,
        senderId: id,
        x: 121,
        y: 181,
      }),
    }),
  );
  expect(result.current.pings).toHaveLength(1);
  act(() => vi.advanceTimersByTime(3000));
  expect(result.current.pings).toHaveLength(0);
  expect(result.current.status).toBe("live");
});

it("limits rapid ping attempts before they can flood the live socket", () => {
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", Socket);
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  const { result } = renderHook(() => useCampaignStream("campaign", true), { wrapper });
  const id = "8f834642-e1a2-42f2-9c5b-a80b91991344";
  act(() => Socket.instances.at(-1)?.snapshot());
  act(() => {
    for (let i = 0; i < 30; i++) result.current.ping(id, 121, 181);
  });
  const sent = () =>
    (Socket.instances.at(-1)?.sent ?? [])
      .map((item) => JSON.parse(item))
      .filter((item) => item.kind === "ping");
  expect(sent()).toHaveLength(1);
  act(() => vi.advanceTimersByTime(500));
  act(() => result.current.ping(id, 121, 181));
  expect(sent()).toHaveLength(2);
});
