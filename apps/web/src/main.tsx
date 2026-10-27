import "@hearth/ui/styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Component, type ReactNode, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="centered-state">
        <h1>The table could not open.</h1>
        <p>Your saved campaigns remain on the host.</p>
        <button type="button" className="button primary" onClick={() => window.location.reload()}>
          Reload Hearth
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: 3000, refetchOnWindowFocus: true } },
});
document.documentElement.dataset.contrast = localStorage.getItem("hearth-high-contrast") ?? "false";
const root = document.getElementById("root");
if (!root) throw new Error("Root element unavailable");
createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={client}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
