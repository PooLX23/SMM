import { LogLevel } from "@azure/msal-browser";
import type { Configuration } from "@azure/msal-browser";

const tenantId = import.meta.env.VITE_ENTRA_TENANT_ID as string;
const clientId = import.meta.env.VITE_ENTRA_SPA_CLIENT_ID as string;

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}/v2.0`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "localStorage",
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
      loggerCallback: (level: LogLevel, message: string) => {
        if (level <= LogLevel.Warning) console.log(message);
      },
      piiLoggingEnabled: false,
    },
  },
};

// ✅ TOKEN DLA TWOJEGO API – TYM tokenem wołasz backend (/api/..)
export const loginRequest = {
  scopes: [import.meta.env.VITE_API_SCOPE as string],
};

// ✅ TOKEN DLA GRAPH – osobno, nie mieszać z API
export const graphRequest = {
  scopes: ["User.Read"],
};
