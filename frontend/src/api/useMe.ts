import { useEffect, useState } from "react";
import { useMsal } from "@azure/msal-react";
import { fetchWithAuth } from "./apiClient";

export type MeResponse = {
  upn: string;
  name: string;
  is_reception: boolean;
  groups_count?: number;
};

export function useMe() {
  const { instance, accounts } = useMsal();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const resp = await fetchWithAuth(instance, accounts, "/me");
        const data = (await resp.json()) as MeResponse;
        if (!alive) return;
        setMe(data);
        setError(null);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Błąd pobierania /me");
      }
    })();
    return () => {
      alive = false;
    };
  }, [instance, accounts]);

  return { me, error };
}
