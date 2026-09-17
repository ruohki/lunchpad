import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { DebugWindow } from "./components/DebugWindow";
import "./index.css";
import "./i18n";

// A debug action's window shows one text instead of the app.
const debugId = new URLSearchParams(window.location.search).get("debug");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{debugId ? <DebugWindow id={debugId} /> : <App />}</React.StrictMode>,
);
