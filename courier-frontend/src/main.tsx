import React from "react";
import { createRoot } from "react-dom/client";
import CourierApp from "./CourierApp";
import "@fontsource-variable/vazirmatn";
import "./style.css";
import "./redesign.css";
import "../../shared/formValidation";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <CourierApp />
  </React.StrictMode>,
);
