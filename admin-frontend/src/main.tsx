import React from "react";
import { createRoot } from "react-dom/client";
import AdminApp from "./AdminApp";
import { ConfirmHost } from "./confirm";
/* @fontsource-variable/vazirmatn: the customer app's face, bundled so the
   panel never waits on a third-party stylesheet to render its text. */
import "@fontsource-variable/vazirmatn";
import "./style.css";
import "./adminShell.css";
import "../../shared/formValidation";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AdminApp />
    <ConfirmHost />
  </React.StrictMode>,
);
