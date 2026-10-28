import "pixi.js/unsafe-eval";
import type { Drawing, MapPing, Scene, Token } from "@hearth/protocol";
import { Maximize, Minus, Plus } from "lucide-react";
import { Application, Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { t } from "../i18n/en";
import { DrawingControls, type DrawingSettings } from "./DrawingControls";
import { hitDrawing, type TextDraft } from "./drawingEditing";
import { type FogRect, type FogTool, fogPixels, fogRectangle, footprintRevealed } from "./fog";
import { appendFreehandPoint, finishFreehand } from "./freehand";
import { InlineDrawingText } from "./InlineDrawingText";
import {
  canPingPoint,
  clampScenePoint,
  type MapTool,
  measureSquares,
  type ScenePoint,
} from "./mapTools";
import { createSceneRenderLoop } from "./sceneRenderLoop";
import { createTextDrawing } from "./textDrawingRenderer";
import { textDrawingBounds, validDrawingText } from "./textDrawings";

type Props = {
  scene: Scene;
  isDm: boolean;
  fogTool: FogTool;
  mapTool: MapTool;
  pings: MapPing[];
  drawing: DrawingSettings;
  onDrawingSettings: (settings: DrawingSettings) => void;
  onDraw: (
    settings: DrawingSettings,
    start: ScenePoint,
    end: ScenePoint,
    points?: ScenePoint[],
  ) => Promise<void>;
  onUndoDrawing: () => void;
  onEraseDrawing: (drawing: Drawing) => Promise<void>;
  onSaveText: (draft: TextDraft) => Promise<void>;
  onCloseDrawing: () => void;
  onPing: (x: number, y: number) => boolean;
  panOnly?: boolean;
  onFog: (rect: FogRect, mode: "reveal" | "hide") => Promise<void>;
  online: boolean;
  busy: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, x: number, y: number) => Promise<void>;
};
type Piece = {
  signature: string;
  container: Container;
  label: Text;
  abort: AbortController;
  state: "loading" | "ready" | "failed";
  bitmap?: ImageBitmap;
};
export function SceneCanvas(props: Props) {
  const { scene } = props;
  const latest = useRef(props);
  latest.current = props;
  const host = useRef<HTMLDivElement>(null);
  const actions = useRef({ fit: () => {}, zoom: (_factor: number) => {} });
  const update = useRef(() => {});
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState<false | "gpu" | "asset">(false);
  const [zoom, setZoom] = useState(100);
  const [distance, setDistance] = useState<number | null>(null);
  const [toolMessage, setToolMessage] = useState<string | null>(null);
  const [textDraft, setTextDraft] = useState<TextDraft | null>(null);
  const textDraftRef = useRef<TextDraft | null>(null);
  textDraftRef.current = textDraft;
  const [textError, setTextError] = useState<string | null>(null);
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 });
  const cancelText = () => {
    setTextDraft(null);
    setTextError(null);
    host.current?.querySelector("canvas")?.focus();
  };
  const changeText = (next: TextDraft) => {
    setTextDraft(next);
    props.onDrawingSettings({
      ...props.drawing,
      text: next.text,
      color: next.color,
      fontSize: next.fontSize,
      visibility: next.visibility,
    });
  };
  const saveText = async () => {
    const submitted = textDraftRef.current;
    if (!submitted || !validDrawingText(submitted.text) || !props.online || props.busy) return;
    setTextError(null);
    try {
      await props.onSaveText(submitted);
      if (textDraftRef.current === submitted) {
        setTextDraft(null);
        props.onDrawingSettings({ ...props.drawing, text: "" });
        host.current?.querySelector("canvas")?.focus();
      }
    } catch (error) {
      if (textDraftRef.current === submitted)
        setTextError(
          error instanceof Error ? error.message : "Could not save text. Your draft is kept.",
        );
    }
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: A scene switch discards only this scene's editor and releases its async ownership.
  useEffect(() => {
    setTextDraft(null);
    setTextError(null);
    return () => {
      textDraftRef.current = null;
    };
  }, [scene.id]);
  useEffect(() => {
    if (
      props.mapTool !== "draw" ||
      props.drawing.erase ||
      props.drawing.shape !== "text" ||
      !props.isDm
    ) {
      setTextDraft(null);
      setTextError(null);
    }
  }, [props.mapTool, props.drawing.erase, props.drawing.shape, props.isDm]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: The renderer consumes the current draft through textDraftRef.
  useEffect(() => update.current(), [textDraft]);
  // Only changing the actual scene/map geometry creates a new renderer.
  const { id, campaignId, name, width, height, gridSize, backgroundAssetId } = scene;
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let disposed = false;
    let initialized = false;
    let cleanup = () => {};
    const abort = new AbortController();
    const bitmaps = new Set<ImageBitmap>();
    const app = new Application();
    let renderLoop: ReturnType<typeof createSceneRenderLoop> | undefined;
    setReady(false);
    setFailure(false);
    setDistance(null);
    setToolMessage(null);
    async function spriteFor(asset: string, signal: AbortSignal) {
      const response = await fetch(api.asset(campaignId, asset), {
        credentials: "same-origin",
        cache: "no-store",
        signal,
      });
      if (!response.ok) throw new Error("Asset unavailable");
      const bitmap = await createImageBitmap(await response.blob());
      if (disposed || signal.aborted) {
        bitmap.close();
        return null;
      }
      bitmaps.add(bitmap);
      return { sprite: new Sprite(Texture.from(bitmap)), bitmap };
    }
    async function mount() {
      if (!element) return;
      await app.init({
        resizeTo: element,
        background: "#181b20",
        antialias: true,
        autoStart: false,
        preference: "webgl",
        resolution: Math.min(devicePixelRatio, 2),
        autoDensity: true,
      });
      initialized = true;
      if (disposed) {
        app.destroy(true, { children: true, texture: true, textureSource: true });
        return;
      }
      element.appendChild(app.canvas);
      const canvas = app.canvas;
      canvas.setAttribute(
        "aria-label",
        `${name} (${id}). Select a token in Scene, then use arrow keys to move it.`,
      );
      canvas.tabIndex = 0;
      const world = new Container();
      app.stage.addChild(world);
      let backgroundLoaded = false;
      let backgroundLoading = false;
      let backgroundFailed = false;
      async function loadBackground() {
        if (disposed || backgroundLoaded || backgroundLoading || !latest.current.online) return;
        backgroundLoading = true;
        try {
          const background = await spriteFor(backgroundAssetId, abort.signal);
          if (!background || disposed) return;
          background.sprite.width = width;
          background.sprite.height = height;
          world.addChildAt(background.sprite, 0);
          backgroundLoaded = true;
          backgroundFailed = false;
          setReady(true);
          renderLoop?.invalidate();
        } catch {
          if (!disposed) backgroundFailed = true;
        } finally {
          backgroundLoading = false;
          refreshFailure();
        }
      }
      const grid = new Graphics();
      for (let x = 0; x <= width; x += gridSize) grid.moveTo(x, 0).lineTo(x, height);
      for (let y = 0; y <= height; y += gridSize) grid.moveTo(0, y).lineTo(width, y);
      grid.stroke({ color: 0xede3c8, alpha: 0.12, width: 1 });
      world.addChild(grid);
      const sharedDrawings = new Graphics();
      world.addChild(sharedDrawings);
      const fogCanvas = document.createElement("canvas");
      fogCanvas.width = latest.current.scene.fog.columns;
      fogCanvas.height = latest.current.scene.fog.rows;
      const fogContext = fogCanvas.getContext("2d");
      if (!fogContext) throw new Error("Fog rendering unavailable");
      const fogTexture = Texture.from(fogCanvas);
      fogTexture.source.scaleMode = "nearest";
      const fogSprite = new Sprite(fogTexture);
      fogSprite.scale.set(gridSize);
      const fogClip = new Graphics().rect(0, 0, width, height).fill(0xffffff);
      fogSprite.mask = fogClip;
      world.addChild(fogSprite, fogClip);
      const preview = new Graphics();
      world.addChild(preview);
      const toolLayer = new Container();
      const rulerLine = new Graphics();
      const pingRings = new Graphics();
      const keyboardCursor = new Graphics();
      const privateDrawings = new Graphics();
      const drawingPreview = new Graphics();
      const textLabels = new Map<string, { signature: string; object: Container }>();
      let previewText: Container | null = null;
      const rulerLabel = new Text({
        text: "",
        style: {
          fontFamily: "system-ui",
          fontSize: 15,
          fontWeight: "700",
          fill: "#fff0c9",
          stroke: { color: "#151a1e", width: 5 },
        },
      });
      rulerLabel.anchor.set(0.5, 1);
      toolLayer.addChild(rulerLine, pingRings, drawingPreview, keyboardCursor, rulerLabel);
      world.addChild(toolLayer);
      let measurement: { start: ScenePoint; end: ScenePoint } | null = null;
      let measurementPointer: number | null = null;
      let pingCursor: ScenePoint | null = null;
      let drawCursor: ScenePoint | null = null;
      let eraserTarget: string | null = null;
      const eraserHighlight = new Graphics();
      toolLayer.addChild(eraserHighlight);
      const canAuthor = () =>
        latest.current.mapTool === "draw" &&
        latest.current.isDm &&
        latest.current.online &&
        !latest.current.busy;
      function highlightEraser() {
        eraserHighlight.clear();
        renderLoop?.invalidate();
        const d = latest.current.scene.drawings?.find((d) => d.id === eraserTarget);
        if (!d || !latest.current.drawing.erase) {
          eraserTarget = null;
          return;
        }
        const points = [
          { x: d.startX, y: d.startY },
          { x: d.endX, y: d.endY },
          ...(d.points ?? []),
        ];
        const left = Math.min(...points.map((p) => p.x)),
          top = Math.min(...points.map((p) => p.y));
        eraserHighlight
          .rect(
            left - 4,
            top - 4,
            Math.max(...points.map((p) => p.x)) - left + 8,
            Math.max(...points.map((p) => p.y)) - top + 8,
          )
          .stroke({ color: 0xe65b5b, width: 2 / world.scale.x });
      }
      function openText(start: ScenePoint, end: ScenePoint, saved?: Drawing) {
        const settings = latest.current.drawing;
        const next: TextDraft = {
          start,
          end,
          text: saved?.text ?? settings.text ?? "",
          fontSize: saved?.fontSize ?? settings.fontSize ?? 24,
          color: saved?.color ?? settings.color,
          visibility: saved?.visibility ?? settings.visibility,
          ...(saved ? { drawingId: saved.id, expectedVersion: saved.version } : {}),
        };
        latest.current.onDrawingSettings({
          ...settings,
          shape: "text",
          erase: false,
          text: next.text,
          fontSize: next.fontSize,
          color: next.color,
          visibility: next.visibility,
        });
        setTextError(null);
        setTextDraft(next);
      }
      let draft: {
        start: ScenePoint;
        end: ScenePoint;
        settings: DrawingSettings;
        pointer: number | null;
        points: ScenePoint[];
        simplified: boolean;
      } | null = null;
      const canDraw = () =>
        canAuthor() &&
        !latest.current.drawing.erase &&
        !textDraftRef.current &&
        (latest.current.scene.drawings?.length ?? 0) < 64;
      function drawShape(
        target: Graphics,
        shape: DrawingSettings["shape"],
        color: string,
        start: ScenePoint,
        end: ScenePoint,
        points: ScenePoint[] = [],
      ) {
        if (shape === "text") return;
        if (shape === "freehand") {
          const first = points[0];
          if (!first) return;
          target.moveTo(first.x, first.y);
          for (const point of points.slice(1)) target.lineTo(point.x, point.y);
        } else if (shape === "line") target.moveTo(start.x, start.y).lineTo(end.x, end.y);
        else
          target.rect(
            Math.min(start.x, end.x),
            Math.min(start.y, end.y),
            Math.abs(end.x - start.x),
            Math.abs(end.y - start.y),
          );
        target.stroke({ color: Number.parseInt(color.slice(1), 16), width: 3, alpha: 0.95 });
      }
      function renderDrawings() {
        sharedDrawings.clear();
        privateDrawings.clear();
        const retained = new Set<string>();
        for (const drawing of latest.current.scene.drawings ?? []) {
          if (drawing.id === textDraftRef.current?.drawingId) continue;
          const target = drawing.visibility === "shared" ? sharedDrawings : privateDrawings;
          if (drawing.shape === "text" && drawing.text !== undefined) {
            retained.add(drawing.id);
            const signature = JSON.stringify(drawing);
            let cached = textLabels.get(drawing.id);
            if (cached?.signature !== signature) {
              cached?.object.destroy({ children: true });
              const object = createTextDrawing(
                drawing.text,
                drawing.color,
                { x: drawing.startX, y: drawing.startY },
                { x: drawing.endX, y: drawing.endY },
                drawing.fontSize ?? 24,
                drawing.textFit ?? false,
              );
              if (!object) continue;
              cached = { signature, object };
              textLabels.set(drawing.id, cached);
            }
            target.addChild(cached.object);
            continue;
          }
          drawShape(
            target,
            drawing.shape,
            drawing.color,
            { x: drawing.startX, y: drawing.startY },
            { x: drawing.endX, y: drawing.endY },
            drawing.points,
          );
        }
        for (const [key, cached] of textLabels) {
          if (!retained.has(key)) {
            cached.object.destroy({ children: true });
            textLabels.delete(key);
          }
        }
      }
      function showDraft() {
        renderLoop?.invalidate();
        drawingPreview.clear();
        previewText?.destroy({ children: true });
        previewText = null;
        if (draft?.settings.shape === "text") {
          previewText = createTextDrawing(
            draft.settings.text ?? "",
            draft.settings.color,
            draft.start,
            draft.end,
            draft.settings.fontSize ?? 24,
          );
          if (previewText) drawingPreview.addChild(previewText);
          drawingPreview
            .rect(
              Math.min(draft.start.x, draft.end.x),
              Math.min(draft.start.y, draft.end.y),
              Math.abs(draft.end.x - draft.start.x),
              Math.abs(draft.end.y - draft.start.y),
            )
            .stroke({ color: draft.settings.color, width: 1 / world.scale.x, alpha: 0.8 });
        }
        if (draft)
          drawShape(
            drawingPreview,
            draft.settings.shape,
            draft.settings.color,
            draft.start,
            draft.end,
            draft.settings.shape === "freehand"
              ? finishFreehand([...draft.points, draft.end]).points
              : undefined,
          );
      }
      function clearDraft() {
        const pointer = draft?.pointer;
        draft = null;
        if (pointer !== null && pointer !== undefined && canvas.hasPointerCapture(pointer))
          canvas.releasePointerCapture(pointer);
        showDraft();
      }
      function extendDraft(point: ScenePoint) {
        if (!draft) return;
        draft.end = point;
        if (draft.settings.shape === "freehand") {
          const next = appendFreehandPoint(draft.points, point);
          draft.points = next.points;
          draft.simplified ||= next.simplified;
        }
        showDraft();
      }
      function finishDraft() {
        const finished = draft;
        const path =
          finished?.settings.shape === "freehand"
            ? finishFreehand([...finished.points, finished.end])
            : undefined;
        clearDraft();
        if (!finished || !canDraw()) return;
        if (finished.settings.shape === "text") {
          const click =
            Math.hypot(finished.end.x - finished.start.x, finished.end.y - finished.start.y) < 5;
          const w = Math.min(240, width),
            h = Math.min(96, height);
          const start = click
            ? {
                x: Math.min(finished.start.x, width - w),
                y: Math.min(finished.start.y, height - h),
              }
            : finished.start;
          const end = click ? { x: start.x + w, y: start.y + h } : finished.end;
          const bounds = textDrawingBounds(start, end);
          if (!bounds) {
            setToolMessage("Drag a larger text box, or click to use a standard box.");
            return;
          }
          setToolMessage(null);
          openText(bounds.start, bounds.end);
          return;
        }
        const dx = Math.abs(finished.end.x - finished.start.x),
          dy = Math.abs(finished.end.y - finished.start.y);
        const length =
          path?.points.slice(1).reduce((total, p, index) => {
            const previous = path.points[index];
            return total + (previous ? Math.hypot(p.x - previous.x, p.y - previous.y) : 0);
          }, 0) ?? Math.hypot(dx, dy);
        if (finished.settings.shape === "rectangle" ? dx < 1 || dy < 1 : length < 1) {
          setToolMessage("Draw a larger shape, or press Esc to cancel.");
          return;
        }
        const start = path?.points[0] ?? finished.start,
          end = path?.points.at(-1) ?? finished.end;
        setToolMessage(
          path && (path.simplified || finished.simplified)
            ? "Stroke simplified to keep it within the 128-point limit."
            : null,
        );
        void latest.current.onDraw(finished.settings, start, end, path?.points).catch(() => {});
      }
      const pingStarted = new Map<string, number>();
      function drawMeasurement() {
        renderLoop?.invalidate();
        rulerLine.clear();
        rulerLabel.visible = measurement !== null;
        if (!measurement) return;
        const { start, end } = measurement;
        const scale = world.scale.x;
        rulerLine
          .moveTo(start.x, start.y)
          .lineTo(end.x, end.y)
          .stroke({ color: 0xf0c47a, width: 3 / scale, alpha: 0.95 });
        rulerLine.circle(start.x, start.y, 5 / scale).fill(0xf7dfad);
        rulerLine.circle(end.x, end.y, 5 / scale).fill(0xf7dfad);
        const squares = measureSquares(start, end, gridSize);
        rulerLabel.text = `${squares} ${squares === 1 ? "square" : "squares"}`;
        rulerLabel.position.set(end.x, end.y - 12 / scale);
        rulerLabel.scale.set(1 / scale);
      }
      function setMeasurement(next: typeof measurement) {
        measurement = next;
        setDistance(next ? measureSquares(next.start, next.end, gridSize) : null);
        drawMeasurement();
      }
      function drawKeyboardCursor() {
        renderLoop?.invalidate();
        keyboardCursor.clear();
        const cursor =
          latest.current.mapTool === "ping"
            ? pingCursor
            : latest.current.mapTool === "draw"
              ? drawCursor
              : null;
        if (!cursor) return;
        const scale = world.scale.x;
        keyboardCursor
          .circle(cursor.x, cursor.y, 10 / scale)
          .stroke({ color: 0xf6dfa6, width: 2 / scale });
        keyboardCursor
          .moveTo(cursor.x - 15 / scale, cursor.y)
          .lineTo(cursor.x + 15 / scale, cursor.y)
          .stroke({ color: 0xf6dfa6, width: 1 / scale });
        keyboardCursor
          .moveTo(cursor.x, cursor.y - 15 / scale)
          .lineTo(cursor.x, cursor.y + 15 / scale)
          .stroke({ color: 0xf6dfa6, width: 1 / scale });
      }
      function drawPings() {
        const now = performance.now();
        const visible = latest.current.pings.filter(
          (ping) => ping.sceneId === id && canPingPoint(latest.current.scene, ping),
        );
        if (visible.length === 0 && pingStarted.size === 0) return false;
        pingRings.clear();
        for (const key of pingStarted.keys())
          if (!visible.some((ping) => ping.pingId === key)) pingStarted.delete(key);
        for (const ping of visible) {
          if (!pingStarted.has(ping.pingId)) pingStarted.set(ping.pingId, now);
          const age = Math.min(1, (now - (pingStarted.get(ping.pingId) ?? now)) / 3000);
          const scale = world.scale.x;
          const alpha = 1 - age * 0.7;
          pingRings
            .circle(ping.x, ping.y, (13 + age * 23) / scale)
            .stroke({ color: 0xf6cd7c, width: 3 / scale, alpha });
          pingRings.circle(ping.x, ping.y, 5 / scale).fill({ color: 0xffe9b4, alpha });
        }
        return visible.length > 0;
      }
      renderLoop = createSceneRenderLoop(() => app.render(), drawPings);
      let fogSignature = "";
      let brush: {
        start: { x: number; y: number };
        rect: FogRect;
        mode: "reveal" | "hide";
        pointer: number;
      } | null = null;
      const canPaint = () =>
        latest.current.isDm &&
        latest.current.online &&
        !latest.current.busy &&
        latest.current.scene.fog.enabled &&
        latest.current.fogTool !== "select";
      function clearBrush() {
        renderLoop?.invalidate();
        brush = null;
        preview.clear();
      }
      function reconcileFog() {
        const f = latest.current.scene.fog;
        const signature = `${f.enabled}:${f.revealed}:${latest.current.isDm}`;
        if (signature !== fogSignature) {
          clearBrush();
          fogContext?.putImageData(new ImageData(fogPixels(f), f.columns, f.rows), 0, 0);
          fogTexture.source.update();
          fogSprite.alpha = latest.current.isDm ? 0.5 : 1;
          fogSignature = signature;
        }
        if (!canPaint() || (brush && brush.mode !== latest.current.fogTool)) clearBrush();
      }
      function drawBrush() {
        renderLoop?.invalidate();
        preview.clear();
        if (!brush) return;
        const r = brush.rect;
        preview
          .rect(
            r.column * gridSize,
            r.row * gridSize,
            Math.min(width - r.column * gridSize, r.width * gridSize),
            Math.min(height - r.row * gridSize, r.height * gridSize),
          )
          .fill({ color: brush.mode === "reveal" ? 0xc4a85b : 0x799eae, alpha: 0.22 })
          .stroke({ color: 0xf4c974, width: 2 });
      }
      const pieces = new Map<string, Piece>();
      let drag: { id: string; x: number; y: number; startX: number; startY: number } | null = null;
      let pan: { x: number; y: number; wx: number; wy: number } | null = null;
      function refreshFailure() {
        if (!disposed)
          setFailure(
            backgroundFailed || [...pieces.values()].some((piece) => piece.state === "failed")
              ? "asset"
              : false,
          );
      }
      function loadPiece(piece: Piece, token: Token) {
        piece.state = "loading";
        void spriteFor(token.assetId, piece.abort.signal)
          .then((result) => {
            if (!result) return;
            if (disposed || piece.abort.signal.aborted) {
              result.sprite.destroy({ texture: true, textureSource: true });
              result.bitmap.close();
              bitmaps.delete(result.bitmap);
              return;
            }
            piece.bitmap = result.bitmap;
            piece.state = "ready";
            result.sprite.anchor.set(0.5);
            result.sprite.width = token.size;
            result.sprite.height = token.size;
            piece.container.addChildAt(result.sprite, 0);
            renderLoop?.invalidate();
            refreshFailure();
          })
          .catch(() => {
            if (!disposed && !piece.abort.signal.aborted) {
              piece.state = "failed";
              refreshFailure();
            }
          });
      }
      function place(piece: Piece, token: Token) {
        piece.container.position.set(token.x, token.y);
        piece.container.alpha =
          token.visibility === "dm" ||
          (latest.current.isDm && !footprintRevealed(latest.current.scene.fog, gridSize, token))
            ? 0.6
            : 1;
        piece.label.text = `${token.visibility === "dm" ? "[DM] " : ""}${token.name}`;
        piece.label.style.fill = latest.current.selectedId === token.id ? "#f4c974" : "#f4eddc";
      }
      function reconcile() {
        if (disposed) return;
        if (measurementPointer !== null && latest.current.mapTool !== "measure") {
          if (canvas.hasPointerCapture(measurementPointer))
            canvas.releasePointerCapture(measurementPointer);
          measurementPointer = null;
        }
        if (latest.current.mapTool !== "ping") pingCursor = null;
        if (latest.current.mapTool !== "draw") drawCursor = null;
        if (
          draft &&
          (!canDraw() || JSON.stringify(draft.settings) !== JSON.stringify(latest.current.drawing))
        )
          clearDraft();
        renderDrawings();
        highlightEraser();
        reconcileFog();
        const tokens = latest.current.scene.tokens;
        for (const [key, piece] of pieces)
          if (
            !tokens.some(
              (token) => token.id === key && piece.signature === `${token.assetId}:${token.size}`,
            )
          ) {
            piece.abort.abort();
            piece.container.destroy({ children: true, texture: true, textureSource: true });
            piece.bitmap?.close();
            if (piece.bitmap) bitmaps.delete(piece.bitmap);
            pieces.delete(key);
            if (drag?.id === key) drag = null;
          }
        for (const token of tokens) {
          let piece = pieces.get(token.id);
          if (!piece) {
            const container = new Container();
            const label = new Text({
              text: token.name,
              style: {
                fontFamily: "system-ui",
                fontSize: 13,
                fill: "#f4eddc",
                fontWeight: "500",
                stroke: { color: "#142020", width: 4 },
              },
            });
            label.anchor.set(0.5, 0);
            label.y = token.size / 2 + 8;
            container.addChild(label);
            world.addChild(container);
            piece = {
              container,
              label,
              abort: new AbortController(),
              state: "loading",
              signature: `${token.assetId}:${token.size}`,
            };
            pieces.set(token.id, piece);
            loadPiece(piece, token);
          } else if (piece.state === "failed" && latest.current.online) loadPiece(piece, token);
          if (drag?.id !== token.id) place(piece, token);
        }
        world.addChild(privateDrawings);
        world.addChild(toolLayer);
        drawMeasurement();
        drawKeyboardCursor();
        if (!pan && !drag && !brush && measurementPointer === null)
          canvas.style.cursor = latest.current.mapTool ? "crosshair" : "grab";
      }
      update.current = () => {
        reconcile();
        void loadBackground();
      };
      update.current();
      function fit() {
        const scale = Math.min(app.screen.width / width, app.screen.height / height) * 0.92;
        world.scale.set(scale);
        world.position.set(
          (app.screen.width - width * scale) / 2,
          (app.screen.height - height * scale) / 2,
        );
        setZoom(Math.round(scale * 100));
        setCamera({ x: world.x, y: world.y, scale: world.scale.x });
        drawMeasurement();
        drawKeyboardCursor();
      }
      function zoomAt(factor: number, x: number, y: number) {
        const previous = world.scale.x;
        const scale = Math.max(0.15, Math.min(4, previous * factor));
        world.position.set(
          x - ((x - world.x) * scale) / previous,
          y - ((y - world.y) * scale) / previous,
        );
        world.scale.set(scale);
        setZoom(Math.round(scale * 100));
        setCamera({ x: world.x, y: world.y, scale: world.scale.x });
        drawMeasurement();
        drawKeyboardCursor();
      }
      function point(e: PointerEvent) {
        const rect = canvas.getBoundingClientRect();
        return {
          x: (e.clientX - rect.left - world.x) / world.scale.x,
          y: (e.clientY - rect.top - world.y) / world.scale.y,
        };
      }
      function clamped(token: Token, x: number, y: number) {
        const snap = (value: number) => (Math.floor(value / gridSize) + 0.5) * gridSize;
        return {
          x: Math.max(token.size / 2, Math.min(width - token.size / 2, snap(x))),
          y: Math.max(token.size / 2, Math.min(height - token.size / 2, snap(y))),
        };
      }
      function sendMapPing(p: ScenePoint) {
        const current = latest.current;
        if (!canPingPoint(current.scene, p)) {
          setToolMessage("Ping a revealed point on the active scene.");
          return;
        }
        setToolMessage(
          current.onPing(p.x, p.y)
            ? null
            : "Ping unavailable. Check your connection or wait a moment.",
        );
      }
      const down = (e: PointerEvent) => {
        if (draft?.pointer !== null && draft?.pointer !== undefined) return;
        if (e.button !== 0 && e.button !== 1) return;
        canvas.focus();
        const p = point(e);
        if (e.button === 0 && latest.current.mapTool === "draw") {
          if (!canAuthor() || textDraftRef.current) return;
          if (latest.current.drawing.erase) {
            const hit = hitDrawing(latest.current.scene.drawings ?? [], p, 8 / world.scale.x);
            if (hit)
              void latest.current
                .onEraseDrawing(hit)
                .catch((error) =>
                  setToolMessage(
                    error instanceof Error ? error.message : "Could not erase drawing.",
                  ),
                );
            return;
          }
          if (latest.current.drawing.shape === "text") {
            const hit = hitDrawing(
              (latest.current.scene.drawings ?? []).filter((d) => d.shape === "text"),
              p,
              0,
            );
            if (hit) {
              openText({ x: hit.startX, y: hit.startY }, { x: hit.endX, y: hit.endY }, hit);
              return;
            }
          }
          if (!canDraw() || p.x < 0 || p.y < 0 || p.x > width || p.y > height) return;
          const start = clampScenePoint(p, width, height);
          draft = {
            start,
            end: start,
            settings: { ...latest.current.drawing },
            points: [start],
            simplified: false,
            pointer: e.pointerId,
          };
          showDraft();
          canvas.setPointerCapture(e.pointerId);
          canvas.style.cursor = "crosshair";
          return;
        }
        if (e.button === 0 && latest.current.mapTool === "measure") {
          if (p.x < 0 || p.y < 0 || p.x > width || p.y > height) return;
          const start = clampScenePoint(p, width, height);
          measurementPointer = e.pointerId;
          setMeasurement({ start, end: start });
          canvas.setPointerCapture(e.pointerId);
          canvas.style.cursor = "crosshair";
          return;
        }
        if (e.button === 0 && latest.current.mapTool === "ping") {
          sendMapPing(p);
          return;
        }
        if (e.button === 0 && canPaint()) {
          if (p.x < 0 || p.y < 0 || p.x >= width || p.y >= height) return;
          const mode = latest.current.fogTool;
          if (mode === "select") return;
          brush = {
            start: p,
            rect: fogRectangle(p, p, gridSize, width, height),
            mode,
            pointer: e.pointerId,
          };
          drawBrush();
          canvas.setPointerCapture(e.pointerId);
          canvas.style.cursor = "crosshair";
          return;
        }
        const token = [...latest.current.scene.tokens]
          .reverse()
          .find((token) => Math.hypot(token.x - p.x, token.y - p.y) <= token.size / 2);
        if (token && e.button === 0 && !latest.current.panOnly) {
          latest.current.onSelect(token.id);
          if (token.canMove && latest.current.online && !latest.current.busy)
            drag = { id: token.id, x: token.x, y: token.y, startX: e.clientX, startY: e.clientY };
        } else pan = { x: e.clientX, y: e.clientY, wx: world.x, wy: world.y };
        canvas.setPointerCapture(e.pointerId);
        canvas.style.cursor = "grabbing";
      };
      const move = (e: PointerEvent) => {
        if (canAuthor() && latest.current.drawing.erase && !pan) {
          eraserTarget =
            hitDrawing(latest.current.scene.drawings ?? [], point(e), 8 / world.scale.x)?.id ??
            null;
          highlightEraser();
          return;
        }
        if (draft?.pointer === e.pointerId) {
          if (!canDraw()) {
            clearDraft();
            return;
          }
          extendDraft(clampScenePoint(point(e), width, height));
          return;
        }
        if (measurementPointer === e.pointerId && measurement) {
          setMeasurement({ ...measurement, end: clampScenePoint(point(e), width, height) });
          return;
        }
        if (brush && brush.pointer === e.pointerId) {
          if (!canPaint()) {
            clearBrush();
            return;
          }
          brush.rect = fogRectangle(brush.start, point(e), gridSize, width, height);
          drawBrush();
          return;
        }
        if (pan || drag) renderLoop?.invalidate();
        if (pan) {
          world.position.set(pan.wx + e.clientX - pan.x, pan.wy + e.clientY - pan.y);
          setCamera({ x: world.x, y: world.y, scale: world.scale.x });
        }
        if (drag) {
          const token = latest.current.scene.tokens.find((t) => t.id === drag?.id);
          const piece = pieces.get(drag.id);
          if (token && piece) {
            const p = clamped(
              token,
              drag.x + (e.clientX - drag.startX) / world.scale.x,
              drag.y + (e.clientY - drag.startY) / world.scale.y,
            );
            piece.container.position.set(p.x, p.y);
          }
        }
      };
      const up = (e: PointerEvent) => {
        if (draft?.pointer === e.pointerId) {
          if (e.type === "pointercancel") clearDraft();
          else {
            extendDraft(clampScenePoint(point(e), width, height));
            finishDraft();
          }
          return;
        }
        if (measurementPointer === e.pointerId) {
          measurementPointer = null;
          if (e.type === "pointercancel") setMeasurement(null);
          if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
          canvas.style.cursor = "crosshair";
          return;
        }
        if (brush && brush.pointer === e.pointerId) {
          const finished = brush;
          clearBrush();
          if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
          canvas.style.cursor = "grab";
          if (e.type !== "pointercancel" && canPaint() && latest.current.fogTool === finished.mode)
            void latest.current.onFog(finished.rect, finished.mode).finally(reconcile);
          return;
        }
        const finished = drag;
        drag = null;
        pan = null;
        canvas.style.cursor = "grab";
        if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
        if (
          finished &&
          e.type !== "pointercancel" &&
          Math.hypot(e.clientX - finished.startX, e.clientY - finished.startY) > 4
        ) {
          const token = latest.current.scene.tokens.find((t) => t.id === finished.id);
          const piece = pieces.get(finished.id);
          if (token?.canMove && piece && latest.current.online && !latest.current.busy) {
            void latest.current
              .onMove(token.id, piece.container.x, piece.container.y)
              .finally(reconcile);
            return;
          }
        }
        reconcile();
      };
      const key = (e: KeyboardEvent) => {
        if (
          (e.ctrlKey || e.metaKey) &&
          e.key.toLowerCase() === "z" &&
          latest.current.mapTool === "draw"
        ) {
          e.preventDefault();
          if (!e.repeat && canAuthor() && latest.current.scene.canUndoDrawing)
            latest.current.onUndoDrawing();
          return;
        }
        if (latest.current.mapTool === "draw" && latest.current.drawing.erase) {
          const objects = latest.current.scene.drawings ?? [];
          if (e.key.startsWith("Arrow")) {
            e.preventDefault();
            const old = objects.findIndex((d) => d.id === eraserTarget);
            const backwards = e.key === "ArrowLeft" || e.key === "ArrowUp";
            const index =
              old < 0
                ? backwards
                  ? objects.length - 1
                  : 0
                : (old + (backwards ? -1 : 1) + objects.length) % objects.length;
            eraserTarget = objects[index]?.id ?? null;
            highlightEraser();
            return;
          }
          if (e.key === "Enter") {
            e.preventDefault();
            const target = objects.find((d) => d.id === eraserTarget);
            if (target && !e.repeat && canAuthor())
              void latest.current
                .onEraseDrawing(target)
                .catch((error) =>
                  setToolMessage(
                    error instanceof Error ? error.message : "Could not erase drawing.",
                  ),
                );
            return;
          }
        }
        if (e.key === "Escape" && draft) {
          clearDraft();
          e.preventDefault();
          return;
        }
        if (e.key === "Escape" && latest.current.mapTool === "draw") {
          e.preventDefault();
          latest.current.onCloseDrawing();
          return;
        }
        if (e.key === "Escape" && measurement) {
          setMeasurement(null);
          e.preventDefault();
          return;
        }
        const directions: Record<string, [number, number]> = {
          ArrowLeft: [-gridSize, 0],
          ArrowRight: [gridSize, 0],
          ArrowUp: [0, -gridSize],
          ArrowDown: [0, gridSize],
        };
        const direction = directions[e.key];
        if (latest.current.mapTool === "draw" && (e.key === "Enter" || direction)) {
          e.preventDefault();
          if (
            !canDraw() ||
            (e.key === "Enter" && e.repeat) ||
            (draft?.pointer !== null && draft?.pointer !== undefined)
          )
            return;
          const current = drawCursor ?? { x: width / 2, y: height / 2 };
          drawCursor = direction
            ? clampScenePoint(
                { x: current.x + direction[0], y: current.y + direction[1] },
                width,
                height,
              )
            : current;
          if (draft) extendDraft(drawCursor);
          if (e.key === "Enter") {
            if (draft) finishDraft();
            else {
              draft = {
                start: drawCursor,
                end: drawCursor,
                settings: { ...latest.current.drawing },
                pointer: null,
                points: [drawCursor],
                simplified: false,
              };
              showDraft();
            }
          }
          drawKeyboardCursor();
          return;
        }
        if (latest.current.mapTool === "measure" && (e.key === "Enter" || direction)) {
          e.preventDefault();
          const center = { x: width / 2, y: height / 2 };
          const current = measurement ?? { start: center, end: center };
          const end = direction
            ? clampScenePoint(
                { x: current.end.x + direction[0], y: current.end.y + direction[1] },
                width,
                height,
              )
            : current.end;
          setMeasurement({ ...current, end });
          return;
        }
        if (latest.current.mapTool === "ping" && (e.key === "Enter" || direction)) {
          e.preventDefault();
          if (e.key === "Enter" && e.repeat) return;
          const current = pingCursor ?? { x: width / 2, y: height / 2 };
          pingCursor = direction
            ? clampScenePoint(
                { x: current.x + direction[0], y: current.y + direction[1] },
                width - 1,
                height - 1,
              )
            : current;
          drawKeyboardCursor();
          if (e.key === "Enter") sendMapPing(pingCursor);
          return;
        }
        const token = latest.current.scene.tokens.find((t) => t.id === latest.current.selectedId);
        if (
          !token?.canMove ||
          !latest.current.online ||
          latest.current.busy ||
          latest.current.panOnly
        )
          return;
        const delta: Record<string, [number, number]> = {
          ArrowLeft: [-gridSize, 0],
          ArrowRight: [gridSize, 0],
          ArrowUp: [0, -gridSize],
          ArrowDown: [0, gridSize],
        };
        const step = delta[e.key];
        if (!step) return;
        e.preventDefault();
        const [dx, dy] = step;
        const p = clamped(token, token.x + dx, token.y + dy);
        void latest.current.onMove(token.id, p.x, p.y);
      };
      const wheel = (e: WheelEvent) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        zoomAt(Math.exp(-e.deltaY * 0.001), e.clientX - rect.left, e.clientY - rect.top);
      };
      const lostCapture = (e: PointerEvent) => {
        if (draft?.pointer === e.pointerId) clearDraft();
      };
      canvas.addEventListener("lostpointercapture", lostCapture);
      const contextRestored = () => renderLoop?.invalidate();
      canvas.addEventListener("webglcontextrestored", contextRestored);
      canvas.addEventListener("pointerdown", down);
      canvas.addEventListener("pointermove", move);
      canvas.addEventListener("pointerup", up);
      canvas.addEventListener("pointercancel", up);
      canvas.addEventListener("keydown", key);
      canvas.addEventListener("wheel", wheel, { passive: false });
      canvas.style.cursor = "grab";
      canvas.style.touchAction = "none";
      app.renderer.on("resize", fit);
      actions.current = {
        fit,
        zoom: (factor) => zoomAt(factor, app.screen.width / 2, app.screen.height / 2),
      };
      cleanup = () => {
        clearDraft();
        canvas.removeEventListener("lostpointercapture", lostCapture);
        for (const piece of pieces.values()) piece.abort.abort();
        canvas.removeEventListener("webglcontextrestored", contextRestored);
        canvas.removeEventListener("pointerdown", down);
        canvas.removeEventListener("pointermove", move);
        canvas.removeEventListener("pointerup", up);
        canvas.removeEventListener("pointercancel", up);
        canvas.removeEventListener("keydown", key);
        canvas.removeEventListener("wheel", wheel);
        app.renderer.off("resize", fit);
      };
      fit();
    }
    void mount().catch(() => {
      if (!disposed) setFailure("gpu");
    });
    return () => {
      disposed = true;
      renderLoop?.dispose();
      abort.abort();
      cleanup();
      update.current = () => {};
      if (initialized) app.destroy(true, { children: true, texture: true, textureSource: true });
      for (const bitmap of bitmaps) bitmap.close();
      bitmaps.clear();
      actions.current = { fit: () => {}, zoom: () => {} };
    };
  }, [id, campaignId, name, width, height, gridSize, backgroundAssetId]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Clear the previous tool's message on an actual mode change.
  useEffect(() => setToolMessage(null), [props.mapTool]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: The imperative renderer reads these values through latest.current.
  useEffect(
    () => update.current(),
    [
      scene.tokens,
      scene.drawings,
      scene.fog,
      props.drawing,
      props.selectedId,
      props.online,
      props.busy,
      props.fogTool,
      props.panOnly,
      props.isDm,
      props.mapTool,
      props.pings,
    ],
  );
  return (
    <div
      className="scene-viewport"
      data-renderer={ready ? "pixi" : failure ? "fallback" : "loading"}
      data-zoom={zoom}
    >
      <div ref={host} className="pixi-host" />
      {props.isDm && props.mapTool === "draw" && (
        <DrawingControls
          settings={props.drawing}
          onChange={(next) => {
            props.onDrawingSettings(next);
            if (textDraft && next.shape === "text" && !next.erase)
              setTextDraft({
                ...textDraft,
                text: next.text ?? textDraft.text,
                color: next.color,
                fontSize: next.fontSize ?? 24,
                visibility: next.visibility,
              });
          }}
          editing={!!textDraft}
          onSaveText={() => void saveText()}
          onCancelText={cancelText}
          textError={textError}
          onClose={() => {
            props.onCloseDrawing();
            host.current?.querySelector("canvas")?.focus();
          }}
          onUndo={props.onUndoDrawing}
          disabled={!props.online || props.busy}
          empty={
            scene.canUndoDrawing !== undefined
              ? !scene.canUndoDrawing
              : (scene.drawings?.length ?? 0) === 0
          }
          full={(scene.drawings?.length ?? 0) >= 64}
        />
      )}
      {textDraft && (
        <InlineDrawingText
          draft={textDraft}
          camera={camera}
          width={width}
          height={height}
          onChange={changeText}
          onSave={() => void saveText()}
          onCancel={cancelText}
          disabled={!props.online || props.busy}
        />
      )}
      {failure === "gpu" && (
        <div className="canvas-fallback">
          {(!scene.fog.enabled || props.isDm) && (
            <img src={api.asset(scene.campaignId, scene.backgroundAssetId)} alt={scene.name} />
          )}
          {scene.fog.enabled && !props.isDm && (
            <p>
              Fog is enabled. Reload or try a browser with WebGL to view the covered map safely.
            </p>
          )}
          <p role="status">{t.canvasError}</p>
        </div>
      )}
      {failure === "asset" && (
        <div className="canvas-art-error" role="status">
          <span>{t.artworkError}</span>
          <button
            type="button"
            className="button"
            disabled={!props.online}
            onClick={() => update.current()}
          >
            {t.retryArtwork}
          </button>
        </div>
      )}
      {!ready && !failure && (
        <p className="canvas-loading" role="status">
          {t.loading}
        </p>
      )}
      {props.pings.some((ping) => ping.sceneId === id && canPingPoint(scene, ping)) && (
        <div className="map-ping-notice" role="status">
          Ping on map
        </div>
      )}
      {props.mapTool && (
        <div className="map-tool-hint" role="status">
          <span>
            {toolMessage ||
              (props.mapTool === "measure"
                ? "Ruler: drag to measure · Enter and arrows to adjust · Esc clears"
                : props.mapTool === "draw"
                  ? props.drawing.erase
                    ? "Eraser: click an object · arrows choose, Enter erases · Ctrl/Command+Z restores"
                    : props.drawing.shape === "freehand"
                      ? "Freehand: drag a stroke · Enter starts/finishes, arrows add points · Esc cancels · 128 saved points"
                      : props.drawing.shape === "text"
                        ? "Text: click or drag, then type on the map · Ctrl/Command+Enter saves · Esc cancels"
                        : "Draw: drag on the map · Enter, arrows, Enter to place · Esc cancels"
                  : "Ping: click the map · arrows and Enter work from the keyboard")}
          </span>
          {distance !== null && (
            <strong data-testid="ruler-distance">
              {distance} {distance === 1 ? "square" : "squares"}
            </strong>
          )}
        </div>
      )}
      <div className="canvas-controls">
        <button
          type="button"
          className="icon-button"
          aria-label={t.zoomIn}
          disabled={!ready}
          onClick={() => actions.current.zoom(1.2)}
        >
          <Plus size={19} />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label={t.zoomOut}
          disabled={!ready}
          onClick={() => actions.current.zoom(1 / 1.2)}
        >
          <Minus size={19} />
        </button>
        <span />
        <button
          type="button"
          className="icon-button"
          aria-label={t.resetView}
          disabled={!ready}
          onClick={() => actions.current.fit()}
        >
          <Maximize size={18} />
        </button>
      </div>
      <div className="canvas-status">
        <span>{props.online ? t.liveTable : t.offlineTable}</span>
        <span>{zoom}%</span>
      </div>
    </div>
  );
}
