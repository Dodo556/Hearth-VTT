import type { Token } from "@hearth/protocol";
import { Container, Graphics } from "pixi.js";
import { tokenStatusCatalog } from "./tokenStatusCatalog";
/** Owned by one token container; no textures, external assets or animation loop. */
export function tokenDecorations() {
  const root = new Container();
  const bar = new Graphics();
  root.addChild(bar);
  const markers = new Map<string, Container>();
  return {
    root,
    update(token: Token) {
      bar.clear();
      const health = token.health;
      bar.visible = !!health;
      if (health) {
        const fraction = Math.max(0, Math.min(1, health.hp / health.maxHp));
        bar
          .roundRect(-token.size / 2, token.size / 2 + 3, token.size, 6, 2)
          .fill({ color: 0x142020, alpha: 0.95 })
          .stroke({ color: 0xb8c2bd, width: 1 });
        if (fraction > 0)
          bar
            .roundRect(-token.size / 2 + 1, token.size / 2 + 4, (token.size - 2) * fraction, 4, 1)
            .fill(fraction <= 0.25 ? 0xe2776c : fraction <= 0.5 ? 0xe4ba6b : 0x8ec995);
      }
      const active = tokenStatusCatalog.filter((s) => token.statuses?.includes(s.id));
      for (const [id, marker] of markers)
        if (!active.some((s) => s.id === id)) {
          marker.destroy({ children: true });
          markers.delete(id);
        }
      active.forEach((status, index) => {
        let marker = markers.get(status.id);
        if (!marker) {
          marker = new Container();
          marker.addChild(
            new Graphics()
              .circle(0, 0, 8)
              .fill({ color: 0x20262c, alpha: 0.95 })
              .stroke({ color: 0xd2ad70, width: 1 }),
          );
          const icon = new Graphics().svg(status.svg);
          icon.scale.set(0.52);
          icon.position.set(-6.24, -6.24);
          marker.addChild(icon);
          root.addChild(marker);
          markers.set(status.id, marker);
        }
        const row = Math.floor(index / 3),
          count = Math.min(3, active.length - row * 3);
        marker.position.set(((index % 3) - (count - 1) / 2) * 17, -token.size / 2 - 10 - row * 17);
      });
    },
  };
}
