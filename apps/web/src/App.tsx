import type { User } from "@hearth/protocol";
import { Button, ErrorMessage, HearthMark } from "@hearth/ui";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { api } from "./api";
import { AuthForm } from "./features/AuthForm";
import { Library } from "./features/Library";
import { Table } from "./features/Table";
import { t } from "./i18n/en";
import { version } from "./version";

function AuthenticatedWorkspace({ user, onLogout }: { user: User; onLogout: () => void }) {
  // Protected projections belong to one authenticated identity. A cookie change
  // in another tab must never reuse the previous DM's scene or journal cache.
  const [cache] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 3000 } } }),
  );
  useEffect(() => () => cache.clear(), [cache]);
  return (
    <QueryClientProvider client={cache}>
      <Routes>
        <Route path="/" element={<Library user={user} onLogout={onLogout} />} />
        <Route path="/campaign/:id" element={<Table user={user} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </QueryClientProvider>
  );
}

export function App() {
  const client = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const health = useQuery({ queryKey: ["health"], queryFn: api.health });
  const me = useQuery({
    queryKey: ["me"],
    queryFn: api.me,
    enabled: health.data?.setupRequired === false,
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
  });
  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      client.clear();
      navigate("/");
    },
  });
  function onSignedIn(user: User, campaignId?: string) {
    client.clear();
    client.setQueryData(["me"], { schemaVersion: 1, user });
    client.setQueryData(["health"], {
      schemaVersion: 1,
      status: "ok",
      setupRequired: false,
      version,
    });
    navigate(campaignId ? `/campaign/${campaignId}` : "/");
  }
  if (health.error || me.error)
    return (
      <main className="centered-state offline-state">
        <HearthMark />
        <WifiOff size={40} strokeWidth={1} />
        <h1>{t.noConnection}</h1>
        <p>{t.connectionHelp}</p>
        <Button
          className="primary"
          onClick={() => {
            void health.refetch();
            void me.refetch();
          }}
        >
          {t.retry}
        </Button>
      </main>
    );
  if (health.isPending || (!health.data.setupRequired && me.isPending))
    return (
      <main className="centered-state">
        <HearthMark />
        <p role="status">{t.loading}</p>
      </main>
    );
  if (health.data.setupRequired) return <AuthForm mode="setup" onSignedIn={onSignedIn} />;
  if (location.pathname === "/join") return <AuthForm mode="join" onSignedIn={onSignedIn} />;
  if (!me.data?.user) return <AuthForm mode="login" onSignedIn={onSignedIn} />;
  const user = me.data.user;
  return (
    <>
      <ErrorMessage error={logout.error} />
      <AuthenticatedWorkspace key={user.id} user={user} onLogout={() => logout.mutate()} />
    </>
  );
}
