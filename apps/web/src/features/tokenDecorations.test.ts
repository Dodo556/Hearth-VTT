// @vitest-environment jsdom
import type { Token } from "@hearth/protocol";
import { expect, it } from "vitest";
import { tokenDecorations } from "./tokenDecorations";
import { tokenStatusCatalog } from "./tokenStatusCatalog";

it("renders every local marker, removes decorations and disposes the owned graphics", () => {
  const decorations = tokenDecorations();
  const token = { size: 60, health: { hp: 0, maxHp: 20 } } as Token;
  for (const status of tokenStatusCatalog) {
    expect(() => decorations.update({ ...token, statuses: [status.id] })).not.toThrow();
    expect(decorations.root.children).toHaveLength(2);
  }
  decorations.update({ ...token, statuses: tokenStatusCatalog.map((s) => s.id) });
  expect(decorations.root.children).toHaveLength(7);
  decorations.update({ ...token, health: undefined, statuses: [] });
  expect(decorations.root.children).toHaveLength(1);
  expect(decorations.root.children[0]?.visible).toBe(false);
  decorations.root.destroy({ children: true });
  expect(decorations.root.destroyed).toBe(true);
});
