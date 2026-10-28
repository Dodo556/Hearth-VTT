import { Container, Graphics, Text } from "pixi.js";
import type { ScenePoint } from "./mapTools";

/** Fit literal local-font text and contain font fallback/overhang in its authorized box. */
export function createTextDrawing(
  text: string,
  color: string,
  start: ScenePoint,
  end: ScenePoint,
): Container | null {
  const left = Math.min(start.x, end.x),
    top = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x),
    height = Math.abs(end.y - start.y);
  if (width < 9 || height < 9) return null;
  const group = new Container();
  group.position.set(left, top);
  const label = new Text({
    text: text.trim(),
    style: {
      fontFamily: "system-ui",
      fontSize: 24,
      lineHeight: 30,
      fill: color,
      stroke: { color: "#151a1e", width: 3 },
      wordWrap: true,
      wordWrapWidth: width - 8,
      breakWords: true,
    },
  });
  label.scale.set(
    Math.min(1, (width - 8) / Math.max(label.width, 1), (height - 8) / Math.max(label.height, 1)),
  );
  label.position.set(4, 4);
  const clip = new Graphics().rect(0, 0, width, height).fill(0xffffff);
  label.mask = clip;
  group.addChild(label, clip);
  return group;
}
