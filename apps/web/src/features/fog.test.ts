import { FogSchema, TokenCommandSchema } from "@hearth/protocol";
import { expect, it } from "vitest";
import { fogPixels, fogRectangle, footprintRevealed } from "./fog";

const fog = { enabled: true, columns: 2, rows: 2, revealed: "09" };
it("validates bounded masks and strict fog commands", () => {
  expect(FogSchema.safeParse(fog).success).toBe(true);
  for (const value of [
    { ...fog, revealed: "ff00" },
    { ...fog, revealed: "zz" },
    { ...fog, columns: 257 },
  ])
    expect(FogSchema.safeParse(value).success).toBe(false);
  const command = {
    type: "fog.paint",
    payload: {
      sceneId: "7b709683-aad3-4a1f-95e3-3751f8e93213",
      column: 0,
      row: 0,
      width: 2,
      height: 1,
      mode: "reveal",
    },
  };
  expect(TokenCommandSchema.safeParse(command).success).toBe(true);
  expect(
    TokenCommandSchema.safeParse({ ...command, payload: { ...command.payload, width: 0 } }).success,
  ).toBe(false);
  expect(
    TokenCommandSchema.safeParse({ ...command, payload: { ...command.payload, mode: "erase" } })
      .success,
  ).toBe(false);
});
it("uses row-major LSB bits and covers every intersected footprint cell", () => {
  expect(footprintRevealed(fog, 60, { x: 30, y: 30, size: 60 })).toBe(true);
  expect(footprintRevealed(fog, 60, { x: 31, y: 30, size: 60 })).toBe(false);
  expect(footprintRevealed(fog, 60, { x: 90, y: 90, size: 60 })).toBe(true);
  expect([...fogPixels(fog)]).toEqual([9, 15, 19, 0, 9, 15, 19, 255, 9, 15, 19, 255, 9, 15, 19, 0]);
  expect([...fogPixels({ ...fog, enabled: false })].filter((_, i) => i % 4 === 3)).toEqual([
    0, 0, 0, 0,
  ]);
});
it("normalizes drag rectangles and clamps the last partial cell", () => {
  expect(fogRectangle({ x: 119, y: 119 }, { x: 1, y: 1 }, 60, 100, 100)).toEqual({
    column: 0,
    row: 0,
    width: 2,
    height: 2,
  });
  expect(fogRectangle({ x: 30, y: 30 }, { x: -100, y: 999 }, 60, 100, 100)).toEqual({
    column: 0,
    row: 0,
    width: 1,
    height: 2,
  });
});
