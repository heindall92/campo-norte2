import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "@/lib/auth";
import { NotificationsProvider } from "@/lib/notifications";
import { DataHubProvider } from "@/lib/data";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <NotificationsProvider>
        <DataHubProvider>
          <App />
        </DataHubProvider>
      </NotificationsProvider>
    </AuthProvider>
  </StrictMode>,
);
