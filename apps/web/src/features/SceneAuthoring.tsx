import { newRequestId, type Scene, type Token, type TokenCommand } from "@hearth/protocol";
import { Button, Dialog, ErrorMessage } from "@hearth/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { t } from "../i18n/en";

type Send = (command: TokenCommand) => Promise<void>;
export function NewSceneDialog({
  campaignId,
  send,
  onCreated,
  onClose,
}: {
  campaignId: string;
  send: Send;
  onCreated: (id: string) => void;
  onClose: () => void;
}) {
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const client = useQueryClient();
  const assets = useQuery({
    queryKey: ["assets", campaignId],
    queryFn: () => api.assets(campaignId),
  });
  const [name, setName] = useState("");
  const [grid, setGrid] = useState(60);
  const [assetId, setAssetId] = useState("");
  const [uploaded, setUploaded] = useState<{ id: string; width: number; height: number } | null>(
    null,
  );
  const asset =
    assetId === "amber-map"
      ? { id: "amber-map", width: 1440, height: 960 }
      : uploaded?.id === assetId
        ? uploaded
        : assets.data?.assets.find((item) => item.id === assetId);
  const upload = useMutation({
    mutationFn: (file: File) => api.uploadAsset(campaignId, file),
    onSuccess: async (result) => {
      setUploaded(result.asset);
      setAssetId(result.asset.id);
      await client.invalidateQueries({ queryKey: ["assets", campaignId] });
    },
  });
  const save = useMutation({
    mutationFn: async () => {
      const sceneId = newRequestId();
      await send({
        type: "scene.create",
        payload: { sceneId, name: name.trim(), assetId, gridSize: grid },
      });
      return sceneId;
    },
    onSuccess: (sceneId) => {
      if (!alive.current) return;
      onCreated(sceneId);
      onClose();
    },
  });
  return (
    <Dialog title={t.newScene} onClose={onClose}>
      <p className="muted">{t.draftHint}</p>
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <label>
          {t.sceneName}
          <input
            aria-label={t.sceneName}
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </label>
        <label>
          {t.mapImage}
          <input
            aria-label={t.mapImage}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={upload.isPending || save.isPending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload.mutate(file);
            }}
          />
        </label>
        <p className="muted">{upload.isPending ? t.uploadingArt : t.mapLimits}</p>
        <label>
          {t.existingMap}
          <select
            aria-label={t.existingMap}
            value={assetId}
            disabled={upload.isPending || save.isPending}
            onChange={(e) => setAssetId(e.target.value)}
          >
            <option value="">{t.chooseMap}</option>
            <option value="amber-map">{t.sampleMap}</option>
            {assets.data?.assets.map((item) => (
              <option key={item.id} value={item.id}>
                {item.id.slice(0, 8)} · {item.width} × {item.height}
              </option>
            ))}
            {uploaded && !assets.data?.assets.some((item) => item.id === uploaded.id) && (
              <option value={uploaded.id}>
                {uploaded.width} × {uploaded.height}
              </option>
            )}
          </select>
        </label>
        {asset && (
          <div className="art-preview">
            <img src={api.asset(campaignId, asset.id)} alt={t.mapPreview} />
            <span>
              {asset.width} × {asset.height} px
            </span>
          </div>
        )}
        <label>
          {t.gridSize}
          <input
            aria-label={t.gridSize}
            type="number"
            required
            min={20}
            max={256}
            step={1}
            value={grid}
            onChange={(e) => setGrid(Number(e.target.value))}
          />
        </label>
        <ErrorMessage error={upload.error ?? save.error ?? assets.error} />
        <div className="dialog-actions">
          <Button type="button" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button
            className="primary"
            type="submit"
            disabled={!asset || !name.trim() || save.isPending || upload.isPending}
          >
            {t.createScene}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
export function TokenEditor({
  scene,
  token,
  mode,
  send,
  onCreated,
  onClose,
}: {
  scene: Scene;
  token?: Token;
  mode: "create" | "edit";
  send: Send;
  onCreated: (id: string) => void;
  onClose: () => void;
}) {
  const editing = mode === "edit";
  const [targetId] = useState(token?.id ?? null);
  const missing = editing && (!token || token.id !== targetId);
  const assets = useQuery({
    queryKey: ["assets", scene.campaignId],
    queryFn: () => api.assets(scene.campaignId),
  });
  const [name, setName] = useState(token?.name ?? "");
  const [assetId, setAssetId] = useState(token?.assetId ?? "token-warden");
  const [size, setSize] = useState(token?.size ?? Math.min(52, scene.gridSize));
  const [x, setX] = useState(
    token?.x ?? (Math.floor(scene.width / (2 * scene.gridSize)) + 0.5) * scene.gridSize,
  );
  const [y, setY] = useState(
    token?.y ?? (Math.floor(scene.height / (2 * scene.gridSize)) + 0.5) * scene.gridSize,
  );
  const [visibility, setVisibility] = useState<"dm" | "shared">("dm");
  const save = useMutation({
    mutationFn: async () => {
      if (missing) throw new Error(t.tokenUnavailable);
      const tokenId = editing ? (targetId ?? "") : newRequestId();
      if (editing)
        await send({
          type: "token.update",
          payload: { tokenId, name: name.trim(), assetId, size },
        });
      else
        await send({
          type: "token.create",
          payload: {
            tokenId,
            sceneId: scene.id,
            name: name.trim(),
            assetId,
            size,
            x,
            y,
            visibility,
          },
        });
      return tokenId;
    },
    onSuccess: (id) => {
      onCreated(id);
      onClose();
    },
  });
  return (
    <Dialog title={editing ? t.editToken : t.addToken} onClose={onClose}>
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <label>
          {t.tokenName}
          <input
            aria-label={t.tokenName}
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </label>
        <label>
          {t.tokenArt}
          <select
            aria-label={t.tokenArt}
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
          >
            <option value="token-warden">{t.wardenArt}</option>
            <option value="token-scout">{t.scoutArt}</option>
            <option value="vault-sentinel">{t.sentinelArt}</option>
            {assets.data?.assets.map((item) => (
              <option key={item.id} value={item.id}>
                {t.uploadedArt} {item.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
        <div className="art-preview token">
          <img src={api.asset(scene.campaignId, assetId)} alt={t.tokenPreview} />
        </div>
        <label>
          {t.tokenSize}
          <input
            aria-label={t.tokenSize}
            type="number"
            required
            min={16}
            max={256}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
          />
        </label>
        {!editing && (
          <>
            <div className="token-coordinates">
              <label>
                {t.tokenX}
                <input
                  aria-label={t.tokenX}
                  type="number"
                  required
                  min={size / 2}
                  max={scene.width - size / 2}
                  step="any"
                  value={x}
                  onChange={(e) => setX(Number(e.target.value))}
                />
              </label>
              <label>
                {t.tokenY}
                <input
                  aria-label={t.tokenY}
                  type="number"
                  required
                  min={size / 2}
                  max={scene.height - size / 2}
                  step="any"
                  value={y}
                  onChange={(e) => setY(Number(e.target.value))}
                />
              </label>
            </div>
            <label>
              {t.tokenVisibility}
              <select
                aria-label={t.tokenVisibility}
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as typeof visibility)}
              >
                <option value="dm">{t.dmOnly}</option>
                <option value="shared">{t.shared}</option>
              </select>
            </label>
          </>
        )}
        <ErrorMessage
          error={missing ? new Error(t.tokenUnavailable) : (save.error ?? assets.error)}
        />
        <div className="dialog-actions">
          <Button type="button" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button
            type="submit"
            className="primary"
            disabled={missing || !name.trim() || save.isPending}
          >
            {editing ? t.saveToken : t.placeToken}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
