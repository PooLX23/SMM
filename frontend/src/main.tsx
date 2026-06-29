import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider, CssBaseline } from "@mui/material";

import { MsalProvider } from "@azure/msal-react";
import { PublicClientApplication, EventType } from "@azure/msal-browser";
import type { AccountInfo } from "@azure/msal-browser";

import App from "./App";
import theme from "./theme";
import { msalConfig } from "./auth/msal";

const msalInstance = new PublicClientApplication(msalConfig);

// Ustaw aktywne konto po udanym loginie
msalInstance.addEventCallback((event) => {
  if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
    const account = (event.payload as { account?: AccountInfo }).account;
    if (account) msalInstance.setActiveAccount(account);
  }
});

async function bootstrap() {
  await msalInstance.initialize();

  try {
    await msalInstance.handleRedirectPromise();
  } catch (err) {
    console.error("MSAL redirect error:", err);
  }

  // Fallback: po odświeżeniu strony ustaw aktywne konto
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length > 0 && !msalInstance.getActiveAccount()) {
    msalInstance.setActiveAccount(accounts[0]);
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <MsalProvider instance={msalInstance}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ThemeProvider>
      </MsalProvider>
    </React.StrictMode>
  );
}

bootstrap().catch((e) => {
  console.error("Bootstrap error:", e);
});
