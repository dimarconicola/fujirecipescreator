import { Component, type ErrorInfo, type ReactNode } from "react";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

const fallbackRootStyle = {
  maxWidth: "760px",
  margin: "48px auto",
  padding: "20px",
  border: "1px solid var(--ui-border-soft)",
  borderRadius: "12px",
  fontFamily: "'Manrope Variable', system-ui, -apple-system, Segoe UI, sans-serif",
  display: "grid",
  gap: "12px",
  color: "var(--ui-text-1)",
  background:
    "linear-gradient(180deg, rgba(21, 31, 45, 0.98), rgba(14, 22, 34, 0.98))",
};

function clearPersistedState(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem("fuji-viewer-session-v1");
  window.localStorage.removeItem("fuji-recipes-v1");
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
    message: "",
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || "Unknown rendering error",
    };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo): void {
    // Keep default logging behavior; UI fallback is the primary recovery path.
  }

  private recoverByResettingState = () => {
    clearPersistedState();
    window.location.reload();
  };

  private recoverByReloading = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <section style={fallbackRootStyle}>
        <h1>Recovery Required</h1>
        <p>
          The app encountered an unexpected state and cannot continue safely.
          Use one of the recovery actions below.
        </p>
        <p>
          <strong>Error:</strong> {this.state.message}
        </p>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button type="button" onClick={this.recoverByResettingState}>
            Reset Session State
          </button>
          <button type="button" onClick={this.recoverByReloading}>
            Reload
          </button>
        </div>
      </section>
    );
  }
}
