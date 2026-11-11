import React from "react";
import { createRoot } from "react-dom/client";
import AdminApp from "./AdminApp";
import "./style.css";
import "./adminShell.css";
import "../../shared/formValidation";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AdminApp />
  </React.StrictMode>,
);
