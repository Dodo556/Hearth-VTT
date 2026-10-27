import { expect, it } from "vitest";
import { createSceneRenderLoop } from "./sceneRenderLoop";

function frames() {
  let id = 0;
  const pending = new Map<number, FrameRequestCallback>();
  return {
    pending,
    schedule(callback: FrameRequestCallback) {
      pending.set(++id, callback);
      return id;
    },
    cancel(key: number) {
      pending.delete(key);
    },
    flush() {
      const callbacks = [...pending.values()];
      pending.clear();
      for (const callback of callbacks) callback(0);
    },
  };
}

it("coalesces scene changes into one frame and stops rendering an idle scene", () => {
  const clock = frames();
  let renders = 0;
  const loop = createSceneRenderLoop(
    () => renders++,
    () => false,
    clock.schedule,
    clock.cancel,
  );
  loop.invalidate();
  loop.invalidate();
  expect(clock.pending.size).toBe(1);
  clock.flush();
  expect(renders).toBe(1);
  expect(clock.pending.size).toBe(0);
  clock.flush();
  expect(renders).toBe(1);
  loop.invalidate();
  clock.flush();
  expect(renders).toBe(2);
});

it("continues animation frames until the final clearing frame, then becomes idle", () => {
  const clock = frames();
  let moving = true;
  let renders = 0;
  const loop = createSceneRenderLoop(
    () => renders++,
    () => moving,
    clock.schedule,
    clock.cancel,
  );
  loop.invalidate();
  clock.flush();
  clock.flush();
  expect(renders).toBe(2);
  expect(clock.pending.size).toBe(1);
  moving = false;
  clock.flush();
  expect(renders).toBe(3);
  expect(clock.pending.size).toBe(0);
});

it("cancels the pending frame and ignores invalidations after scene disposal", () => {
  const clock = frames();
  let renders = 0;
  const loop = createSceneRenderLoop(
    () => renders++,
    () => true,
    clock.schedule,
    clock.cancel,
  );
  loop.invalidate();
  const stale = [...clock.pending.values()][0];
  loop.dispose();
  expect(clock.pending.size).toBe(0);
  stale?.(0);
  loop.invalidate();
  clock.flush();
  expect(renders).toBe(0);
});

it("preserves a change requested while a frame is rendering without duplicating frames", () => {
  const clock = frames();
  let renders = 0;
  const loop = createSceneRenderLoop(
    () => {
      if (++renders === 1) loop.invalidate();
    },
    () => false,
    clock.schedule,
    clock.cancel,
  );
  loop.invalidate();
  clock.flush();
  expect(clock.pending.size).toBe(1);
  clock.flush();
  expect(renders).toBe(2);
  expect(clock.pending.size).toBe(0);
});
