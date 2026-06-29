import type {
  IPublicClientApplication,
  AccountInfo,
  SilentRequest,
} from "@azure/msal-browser";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { loginRequest } from "../auth/msal";

const API_BASE_URL = "/api"; // produkcyjnie przez nginx; nie zależymy od .env

function pickAccount(
  msal: IPublicClientApplication,
  accounts: AccountInfo[]
): AccountInfo | null {
  // MSAL 5.x: po odświeżeniu strony accounts bywa puste, ale activeAccount już jest
  return msal.getActiveAccount() ?? (accounts?.[0] ?? null);
}

async function getAccessToken(
  msal: IPublicClientApplication,
  accounts: AccountInfo[]
): Promise<string> {
  const account = pickAccount(msal, accounts);
  if (!account) {
    throw new Error("Brak konta MSAL (użytkownik niezalogowany lub brak activeAccount).");
  }

  const silentRequest: SilentRequest = {
    ...(loginRequest as any),
    account,
  };

  try {
    const result = await msal.acquireTokenSilent(silentRequest);
    return result.accessToken;
  } catch (e: any) {
    // kiedy wymagany jest prompt (np. po zmianie uprawnień), MSAL wymaga interakcji
    if (e instanceof InteractionRequiredAuthError) {
      await msal.loginRedirect(loginRequest as any);
      // loginRedirect przerywa flow przez redirect, więc poniższe raczej nie wróci
      throw e;
    }
    throw e;
  }
}

function buildUrl(path: string): string {
  // pozwalamy podać pełny URL, ale standardowo używamy /api/<endpoint>
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (!path.startsWith("/")) path = `/${path}`;
  return `${API_BASE_URL}${path}`;
}

async function readErrorText(resp: Response): Promise<string> {
  try {
    const ct = resp.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const j = await resp.json().catch(() => null);
      if (j && typeof j === "object") {
        if ("detail" in j) return String((j as any).detail);
        return JSON.stringify(j);
      }
    }
    return await resp.text();
  } catch {
    return resp.statusText;
  }
}

/**
 * Niskopoziomowy fetch z bearer tokenem.
 * Zwraca Response (żebyś mógł pobierać json/text/bytes).
 */
export async function fetchWithAuth(
  msal: IPublicClientApplication,
  accounts: AccountInfo[],
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const token = await getAccessToken(msal, accounts);
  const url = buildUrl(path);

  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${token}`);

  // jeśli wysyłamy body i nie ma content-type, ustaw JSON (dla string/Blob nie ustawiamy)
  if (init.body && !headers.has("Content-Type") && typeof init.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  const resp = await fetch(url, { ...init, headers });

  if (!resp.ok) {
    const msg = await readErrorText(resp);
    throw new Error(`API ${resp.status} ${resp.statusText}: ${msg}`);
  }

  return resp;
}

/**
 * Wygodny helper: GET JSON
 */
export async function apiGetJson<T>(
  msal: IPublicClientApplication,
  accounts: AccountInfo[],
  path: string
): Promise<T> {
  const resp = await fetchWithAuth(msal, accounts, path, { method: "GET" });
  return (await resp.json()) as T;
}

/**
 * Wygodny helper: POST JSON
 */
export async function apiPostJson<TOut, TIn>(
  msal: IPublicClientApplication,
  accounts: AccountInfo[],
  path: string,
  body: TIn
): Promise<TOut> {
  const resp = await fetchWithAuth(msal, accounts, path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await resp.json()) as TOut;
}

/**
 * Wygodny helper: PATCH JSON
 */
export async function apiPatchJson<TOut, TIn>(
  msal: IPublicClientApplication,
  accounts: AccountInfo[],
  path: string,
  body: TIn
): Promise<TOut> {
  const resp = await fetchWithAuth(msal, accounts, path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await resp.json()) as TOut;
}

/**
 * Wygodny helper: DELETE
 */
export async function apiDelete(
  msal: IPublicClientApplication,
  accounts: AccountInfo[],
  path: string
): Promise<void> {
  await fetchWithAuth(msal, accounts, path, { method: "DELETE" });
}
