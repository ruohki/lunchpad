import { Component, type ErrorInfo, type ReactNode } from "react";
import i18n from "../i18n";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  info: ErrorInfo | null;
}

/**
 * Catches render errors anywhere in the React tree and shows a readable
 * report instead of a blank window. The stack is kept on screen so it can be
 * copied into a bug report.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error", error, info);
    this.setState({ info });
  }

  private reset = () => {
    this.setState({ error: null, info: null });
  };

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex h-full items-center justify-center bg-stage-950 p-8">
        <div className="w-full max-w-2xl rounded-2xl border border-danger/40 bg-stage-900 p-6 shadow-2xl">
          <h1 className="text-xl font-semibold text-danger">{i18n.t("crash.title")}</h1>
          <p className="mt-2 text-sm text-stage-300">{i18n.t("crash.intro")}</p>
          <div className="mt-4 rounded-lg bg-stage-950 p-3 font-mono text-xs text-stage-200">
            <div className="font-semibold text-stage-100">
              {error.name}: {error.message}
            </div>
            {error.stack && (
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-stage-400">
                {error.stack}
              </pre>
            )}
            {info?.componentStack && (
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-stage-500">
                {info.componentStack}
              </pre>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={this.reset}
              className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-stage-950 hover:bg-accent-400"
            >
              {i18n.t("common.tryAgain")}
            </button>
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg bg-stage-700 px-4 py-2 text-sm font-medium text-stage-100 hover:bg-stage-600"
            >
              {i18n.t("common.reload")}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
