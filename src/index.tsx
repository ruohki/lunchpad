/* @refresh reload */
import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
/*
import App from "./App";
*/
import {ModalProvider} from "./components/modal";
import App from "./App.tsx";

const ContextApp = () => (
  <ModalProvider>
    <App />
  </ModalProvider>
)


ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <ContextApp />
    </React.StrictMode>,
);
