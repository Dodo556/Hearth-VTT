import { Button, Dialog, ErrorMessage } from "@hearth/ui";
import { useMutation } from "@tanstack/react-query";
import { Check, Copy, Link as LinkIcon, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { api } from "../api";
import { t } from "../i18n/en";

export function HostingGuide({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title={t.hostingTitle} onClose={onClose}>
      <p className="muted">{t.hostingIntro}</p>
      <ol className="hosting-steps">
        {t.hostingSteps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="notice">
        <ShieldCheck size={18} />
        {t.futureNote}
      </p>
      <Button className="primary full-width" onClick={onClose}>
        {t.cancel}
      </Button>
    </Dialog>
  );
}

export function InviteDialog({ campaignId, onClose }: { campaignId: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<Error | null>(null);
  const create = useMutation({ mutationFn: () => api.invite(campaignId) });
  const revoke = useMutation({
    mutationFn: () => api.revokeInvite(campaignId, create.data?.invite.id ?? ""),
    onSuccess: () => {
      create.reset();
      setCopied(false);
    },
  });
  const link = create.data ? `${window.location.origin}/join#code=${create.data.invite.code}` : "";
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setCopyError(null);
    } catch {
      setCopyError(
        new Error("Clipboard unavailable. Select and copy the invitation link manually."),
      );
    }
  }
  return (
    <Dialog title={t.invitePlayers} onClose={onClose}>
      <div className="invite-symbol">
        <LinkIcon size={28} />
      </div>
      <p>{t.inviteIntro}</p>
      {create.data ? (
        <>
          <label>
            {t.invitationLink}
            <input
              className="invite-link"
              readOnly
              value={link}
              onFocus={(e) => e.target.select()}
            />
          </label>
          <div className="dialog-actions">
            <Button onClick={() => revoke.mutate()} disabled={revoke.isPending}>
              {t.revokeInvite}
            </Button>
            <Button className="primary" onClick={copyLink}>
              {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? t.copied : t.copy}
            </Button>
          </div>
        </>
      ) : (
        <Button
          className="primary full-width"
          disabled={create.isPending}
          onClick={() => create.mutate()}
        >
          {create.isPending ? t.working : t.generateInvite}
        </Button>
      )}
      <ErrorMessage error={create.error ?? revoke.error ?? copyError} />
      <p className="notice">{t.inviteLocalHint}</p>
    </Dialog>
  );
}
