import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import BenchmarkComparison from "./BenchmarkComparison";
import { colors, typography, spacing } from "./design-system";
import "./index.css";

type Route = "debug" | "benchmark";

function Router() {
  const [route, setRoute] = useState<Route>(() => {
    const hash = window.location.hash.slice(1);
    return hash === "benchmark" ? "benchmark" : "debug";
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      setRoute(hash === "benchmark" ? "benchmark" : "debug");
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  return (
    <>
      <nav className="global-nav">
        <div className="nav-brand">
          <span className="brand-text">Tana MCP</span>
        </div>
        <div className="nav-tabs">
          <a
            href="#debug"
            className={`nav-tab ${route === "debug" ? "active" : ""}`}
            onClick={() => setRoute("debug")}
          >
            Debug Console
          </a>
          <a
            href="#benchmark"
            className={`nav-tab ${route === "benchmark" ? "active" : ""}`}
            onClick={() => setRoute("benchmark")}
          >
            Benchmark
          </a>
        </div>
      </nav>
      <main className="main-content">
        {route === "debug" ? <App /> : <BenchmarkComparison />}
      </main>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');

        .global-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 ${spacing.xl};
          height: 48px;
          background: ${colors.bg.base};
          border-bottom: 1px solid ${colors.border.default};
          font-family: ${typography.sans};
        }

        .nav-brand {
          display: flex;
          align-items: center;
        }

        .brand-text {
          font-size: ${typography.base};
          font-weight: ${typography.semibold};
          color: ${colors.text.primary};
        }

        .nav-tabs {
          display: flex;
          gap: ${spacing.xs};
        }

        .nav-tab {
          padding: ${spacing.sm} ${spacing.md};
          font-size: ${typography.sm};
          font-weight: ${typography.medium};
          color: ${colors.text.muted};
          text-decoration: none;
          border-radius: 4px;
          transition: all 150ms ease;
        }

        .nav-tab:hover {
          color: ${colors.text.secondary};
          background: ${colors.bg.hover};
        }

        .nav-tab.active {
          color: ${colors.text.primary};
          background: ${colors.bg.elevated};
        }

        .main-content {
          min-height: calc(100vh - 48px);
        }
      `}</style>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>
);
