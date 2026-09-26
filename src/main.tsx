import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { DebugWindow } from "./components/DebugWindow";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";
import "./i18n";

// A debug action's window shows one text instead of the app.
const debugId = new URLSearchParams(window.location.search).get("debug");

// The boundary inside App catches what its children throw and leaves the app
// standing; this one is for App itself and for the debug window, which would
// otherwise be a blank frame with the reason only in the console.
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>{debugId ? <DebugWindow id={debugId} /> : <App />}</ErrorBoundary>
  </React.StrictMode>,
);
