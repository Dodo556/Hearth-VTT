import type { Campaign, User } from "@hearth/protocol";
import { Button, Dialog, ErrorMessage, HearthMark } from "@hearth/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  CircleHelp,
  Compass,
  FolderOpen,
  HardDrive,
  LogOut,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  SunMoon,
} from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { t } from "../i18n/en";
import { HostingGuide } from "./dialogs";

const BackupRecovery = lazy(() =>
  import("./BackupRecovery").then((module) => ({ default: module.BackupRecovery })),
);

export function CampaignEditor({
  campaign,
  onClose,
}: {
  campaign?: Campaign;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [name, setName] = useState(campaign?.name ?? "");
  const [description, setDescription] = useState(campaign?.description ?? "");
  const [createDemo, setCreateDemo] = useState(false);
  const [archived, setArchived] = useState(campaign?.archived ?? false);
  const mutation = useMutation({
    mutationFn: () =>
      campaign
        ? api.updateCampaign(campaign.id, { name, description, archived })
        : api.createCampaign({ name, description, createDemo }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["campaigns"] });
      await client.invalidateQueries({ queryKey: ["campaign", campaign?.id] });
      onClose();
    },
  });
  return (
    <Dialog title={campaign ? t.editCampaign : t.newCampaign} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <label>
          {t.campaignName}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.campaignNamePlaceholder}
            required
            maxLength={100}
          />
        </label>
        <label>
          {t.description}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t.descriptionPlaceholder}
            maxLength={1000}
            rows={3}
          />
        </label>
        {campaign ? (
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => setArchived(e.target.checked)}
            />
            {t.archived}
          </label>
        ) : (
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={createDemo}
              onChange={(e) => setCreateDemo(e.target.checked)}
            />
            {t.demoCheckbox}
          </label>
        )}
        <ErrorMessage error={mutation.error} />
        <div className="dialog-actions">
          <Button type="button" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button className="primary" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? t.working : campaign ? t.saveChanges : t.createCampaign}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function Library({ user, onLogout }: { user: User; onLogout: () => void }) {
  const query = useQuery({ queryKey: ["campaigns"], queryFn: api.campaigns });
  const [search, setSearch] = useState("");
  const [archived, setArchived] = useState(false);
  const [editing, setEditing] = useState<Campaign | "new" | null>(null);
  const [help, setHelp] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [highContrast, setHighContrast] = useState(
    localStorage.getItem("hearth-high-contrast") === "true",
  );
  const campaigns = (query.data?.campaigns ?? []).filter(
    (c) =>
      c.archived === archived &&
      `${c.name} ${c.description}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  const sample = query.data?.campaigns.find((c) => c.sceneCount > 0 && !c.archived);
  return (
    <div className="workspace-layout">
      <aside className="workspace-sidebar">
        <Link to="/" className="brand-link">
          <HearthMark />
        </Link>
        <span className="nav-caption">{t.workspace}</span>
        <nav aria-label={t.workspace}>
          <Link className="nav-item selected" to="/">
            <Compass size={19} />
            {t.campaigns}
            <span className="nav-count">{query.data?.campaigns.length ?? "—"}</span>
          </Link>
          <button type="button" className="nav-item" onClick={() => setHelp(true)}>
            <CircleHelp size={19} />
            {t.help}
          </button>
          {user.isOwner && (
            <button type="button" className="nav-item" onClick={() => setRecoveryOpen(true)}>
              <HardDrive size={19} />
              Backup & recovery
            </button>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-card">
            <ShieldCheck size={23} />
            <strong>{t.privateByDesign}</strong>
            <p>{t.privateNote}</p>
          </div>
          <div className="user-row">
            <span className="avatar">{user.displayName.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{user.displayName}</strong>
              <small>{user.isOwner ? t.dm : t.player}</small>
            </div>
            <button type="button" className="icon-button" aria-label={t.signOut} onClick={onLogout}>
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="workspace-topbar">
          <span className="breadcrumb">
            {t.workspace}
            <span>/</span>
            {t.campaigns}
          </span>
          <div className="topbar-right">
            <span className="host-badge">
              <i />
              {t.localHost}
            </span>
            <button
              type="button"
              className="icon-button"
              aria-pressed={highContrast}
              title={t.highContrast}
              onClick={() => {
                const next = !highContrast;
                setHighContrast(next);
                document.documentElement.dataset.contrast = String(next);
                localStorage.setItem("hearth-high-contrast", String(next));
              }}
            >
              <SunMoon size={18} />
              <span className="sr-only">{t.highContrast}</span>
            </button>
          </div>
        </header>
        <main className="library-content">
          <div className="page-title">
            <div>
              <span className="eyebrow">{t.greeting(user.displayName)}</span>
              <h1>
                {t.yourCampaigns}
                <span className="heading-dot">.</span>
              </h1>
              <p>{t.libraryIntro}</p>
            </div>
            {user.isOwner && (
              <Button className="primary" onClick={() => setEditing("new")}>
                <Plus size={18} />
                {t.newCampaign}
              </Button>
            )}
          </div>
          {sample && !search && !archived && (
            <section className="featured-world">
              <img src={api.asset(sample.id, "amber-map")} alt="" />
              <div className="featured-shade" />
              <div className="featured-copy">
                <span className="eyebrow">
                  <Sparkles size={14} />
                  {t.sampleWorld}
                </span>
                <h2>{t.continueStory}</h2>
                <p>{t.sampleIntro}</p>
                <Link to={`/campaign/${sample.id}`} className="button light-button">
                  {t.exploreSample}
                  <ArrowRight size={16} />
                </Link>
              </div>
              <span className="featured-label">
                <BookOpen size={14} />
                {sample.name}
              </span>
            </section>
          )}
          <div className="library-filters">
            <div className="segmented">
              <button
                type="button"
                className={!archived ? "selected" : ""}
                aria-pressed={!archived}
                onClick={() => setArchived(false)}
              >
                {t.active}
                <span>{query.data?.campaigns.filter((c) => !c.archived).length ?? 0}</span>
              </button>
              <button
                type="button"
                className={archived ? "selected" : ""}
                aria-pressed={archived}
                onClick={() => setArchived(true)}
              >
                {t.archived}
              </button>
            </div>
            <label className="search-field">
              <Search size={16} />
              <span className="sr-only">{t.search}</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.search}
              />
            </label>
          </div>
          <ErrorMessage error={query.error} />
          {query.isPending && <p role="status">{t.loading}</p>}
          <div className="campaign-grid">
            {campaigns.map((campaign) => (
              <article className="campaign-card" key={campaign.id}>
                <Link
                  className="campaign-art"
                  to={`/campaign/${campaign.id}`}
                  aria-label={`${t.openTable}: ${campaign.name}`}
                >
                  {campaign.sceneCount > 0 ? (
                    <img src={api.asset(campaign.id, "amber-map")} alt="" />
                  ) : (
                    <div className="empty-art">
                      <Compass size={66} strokeWidth={0.8} />
                      <div className="orbit orbit-one" />
                      <div className="orbit orbit-two" />
                    </div>
                  )}
                  <span className={`role-badge ${campaign.role}`}>
                    {campaign.role === "dm" ? t.dm : t.player}
                  </span>
                  <span className="card-open">
                    <ArrowRight size={18} />
                  </span>
                </Link>
                <div className="campaign-card-body">
                  <div className="campaign-card-heading">
                    <Link to={`/campaign/${campaign.id}`}>
                      <h2>{campaign.name}</h2>
                    </Link>
                    {campaign.role === "dm" && (
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`${t.editCampaign}: ${campaign.name}`}
                        onClick={() => setEditing(campaign)}
                      >
                        <Settings2 size={17} />
                      </button>
                    )}
                  </div>
                  <p>{campaign.description || t.emptyCampaigns}</p>
                  <div className="campaign-card-footer">
                    <span>
                      <FolderOpen size={14} />
                      {t.sceneCount(campaign.sceneCount)}
                    </span>
                    <span>{t.genericSystem}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {!query.isPending && !query.error && campaigns.length === 0 && (
            <div className="empty-state">
              <Compass size={42} strokeWidth={1} />
              <h2>{search ? t.noResults : t.noCampaigns}</h2>
              <p>{t.emptyCampaigns}</p>
            </div>
          )}
          <div className="stage-callout">
            <span className="stage-icon">
              <Sparkles size={20} />
            </span>
            <div>
              <strong>{t.stageNote}</strong>
              <p>{t.stageDescription}</p>
            </div>
            <span className="stage-tag">{t.foundation}</span>
          </div>
          <footer className="library-footer">
            <span>
              <span className="status-dot" />
              {t.storedLocally}
            </span>
            <span>{t.tagline}</span>
          </footer>
        </main>
      </div>
      {editing && (
        <CampaignEditor
          campaign={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}{" "}
      {help && <HostingGuide onClose={() => setHelp(false)} />}
      {user.isOwner && recoveryOpen && (
        <Suspense fallback={<p role="status">Loading host tools…</p>}>
          <BackupRecovery onClose={() => setRecoveryOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
