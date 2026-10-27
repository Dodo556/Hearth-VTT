import type { User } from "@hearth/protocol";
import { Button, ErrorMessage, HearthMark } from "@hearth/ui";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../api";
import { t } from "../i18n/en";

export function AuthForm({
  mode,
  onSignedIn,
}: {
  mode: "setup" | "login" | "join";
  onSignedIn: (user: User, campaignId?: string) => void;
}) {
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState(new URLSearchParams(location.hash.slice(1)).get("code") ?? "");
  const [createDemo, setCreateDemo] = useState(true);
  const mutation = useMutation({
    mutationFn: async () => {
      const credentials = { username, displayName, password };
      if (mode === "setup") return api.setup({ ...credentials, createDemo });
      if (mode === "join") return api.join({ ...credentials, code: code.trim() });
      return api.login({ username, password });
    },
    onSuccess: (result) => {
      setPassword("");
      onSignedIn(
        result.user,
        "campaignId" in result && typeof result.campaignId === "string"
          ? result.campaignId
          : undefined,
      );
    },
  });
  const title = mode === "setup" ? t.setupTitle : mode === "join" ? t.joinTitle : t.loginTitle;
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <Link to="/" className="brand-link">
          <HearthMark />
        </Link>
        <div className="story-copy">
          <span className="eyebrow">
            <span className="tiny-line" />
            {t.privateByDesign}
          </span>
          <h1>{t.welcome}</h1>
          <p>{t.privateNote}</p>
        </div>
        <div className="keep-illustration" aria-hidden="true">
          <svg viewBox="0 0 700 430" fill="none" aria-hidden="true">
            <path
              d="M50 360 355 200l295 160-305 160Z"
              fill="#d6b773"
              fillOpacity=".02"
              stroke="#c6a56a"
              strokeOpacity=".2"
            />
            <path
              d="m170 310 170-92 176 92-176 90Z"
              fill="#192323"
              stroke="#c6a56a"
              strokeOpacity=".6"
            />
            <path
              d="M220 286V139l120 65v196l-120-64Zm240 0V139l-120 65v196l120-64Z"
              fill="#1b2525"
              stroke="#c6a56a"
              strokeOpacity=".5"
            />
            <path
              d="m220 139 120-66 120 66-120 65Z"
              fill="#26302d"
              stroke="#c6a56a"
              strokeOpacity=".65"
            />
            <path
              d="M205 140v-35l25-14v25l25-14V77l25-14v25l25-14V49l35-19 35 19v25l25 14V63l25 14v25l25 14V91l25 14v35l-135 74Z"
              stroke="#c6a56a"
              strokeOpacity=".6"
            />
            <path
              d="M317 386v-80q23-30 46 0v80"
              fill="#d4ac62"
              fillOpacity=".2"
              stroke="#d4ac62"
              strokeOpacity=".7"
            />
            <path
              d="m250 200 24 13v34l-24-13Zm160 13 24-13v34l-24 13Z"
              fill="#d4ac62"
              fillOpacity=".5"
            />
            <path
              d="m70 325 55-30m440-10 65 37M130 390l45 25m350 0 50-27"
              stroke="#c6a56a"
              strokeOpacity=".3"
            />
          </svg>
        </div>
        <div className="auth-footer">
          <ShieldCheck size={16} />
          <span>{t.storedLocally}</span>
          <span className="footer-separator">/</span>
          <span>{t.hostRequired}</span>
        </div>
      </section>
      <section className="auth-form-area">
        <div className="auth-form-card">
          <div className="form-symbol">
            {mode === "join" ? <Sparkles size={23} /> : <LockKeyhole size={23} />}
          </div>
          <span className="eyebrow">{t.foundation}</span>
          <h2>{title}</h2>
          <p className="muted form-intro">
            {mode === "setup" ? t.setupIntro : mode === "join" ? t.joinIntro : t.loginIntro}
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate();
            }}
          >
            {mode === "join" && (
              <label>
                {t.inviteCode}
                <input
                  name="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  autoComplete="off"
                  maxLength={64}
                />
              </label>
            )}
            <label>
              {t.username}
              <input
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                minLength={3}
                maxLength={32}
                pattern="[A-Za-z0-9_-]+"
              />
              {mode !== "login" && <small>{t.usernameHint}</small>}
            </label>
            {mode !== "login" && (
              <label>
                {t.displayName}
                <input
                  name="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="nickname"
                  required
                  maxLength={64}
                />
              </label>
            )}
            <label>
              {t.password}
              <input
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={mode === "login" ? 1 : 12}
                maxLength={128}
              />
              {mode !== "login" && <small>{t.passwordHint}</small>}
            </label>
            {mode === "setup" && (
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
            <Button className="primary full-width" disabled={mutation.isPending} type="submit">
              {mutation.isPending
                ? t.working
                : mode === "setup"
                  ? t.setupAction
                  : mode === "join"
                    ? t.joinAction
                    : t.loginAction}
              <ArrowRight size={17} />
            </Button>
          </form>
          {mode === "login" ? (
            <Link className="form-switch" to="/join">
              {t.haveInvite}
            </Link>
          ) : mode === "join" ? (
            <Link className="form-switch" to="/">
              {t.alreadyAccount}
            </Link>
          ) : null}
          <p className="development-note">{t.futureNote}</p>
        </div>
      </section>
    </main>
  );
}
