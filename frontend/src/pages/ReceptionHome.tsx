import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import AppShell from "../components/AppShell";
import PostalCityFields from "../components/PostalCityFields";
import { isPostalCodeValid } from "../utils/postalAddress";
import { apiGetJson, apiPostJson, fetchWithAuth } from "../api/apiClient";

type SimpleDictItem = { id: string; name: string };
type CostCenterOut = { id: string; code: string; name: string; active: boolean };

type ShipmentOut = {
  id: string;
  internal_no: string;
  direction: string;
  status: string;

  recipient_name: string;
  recipient_email: string;
  recipient_phone: string;

  recipient_postal_code: string;
  recipient_city: string;
  recipient_country: string;
  recipient_street: string;

  contents: string;
  vin?: string | null;
  plate_no?: string | null;

  cost_center_id: string;
  cost_center_code?: string | null;
  cost_center_name?: string | null;

  requested_by_upn?: string | null;
  requested_by_name?: string | null;

  carrier_id?: string | null;
  carrier_tracking_no?: string | null;

  received_at?: string | null;
  shipped_at?: string | null;
  cancelled_at?: string | null;
  cancelled_after_shipped_at?: string | null;
  shipping_changed_at?: string | null;

  created_at: string;
  updated_at: string;
};

type IncomingShipmentOut = {
  id: string;
  internal_no: string;
  direction: string;
  status: string;

  carrier_id?: string | null;
  carrier_name?: string | null;
  carrier_tracking_no: string;

  sender_name: string;
  contents?: string | null;

  recipient_upn: string;
  recipient_name: string;

  received_at?: string | null;
  picked_up_at?: string | null;

  created_at: string;
  updated_at: string;
};

type IncomingShipmentCreate = {
  carrier_id?: string | null;
  carrier_tracking_no: string;
  sender_name: string;
  recipient_upn: string;
  recipient_name: string;
  contents?: string | null;
};

type GraphUser = {
  id?: string | null;
  type?: "user" | "m365_group" | "mail_security_group" | "distribution_list";
  displayName?: string | null;
  userPrincipalName?: string | null;
  mail?: string | null;
  label?: string | null;
};

function statusLabel(status: string) {
  switch (status) {
    case "CREATED":
      return "Utworzona";
    case "AT_RECEPTION":
      return "Na recepcji";
    case "SHIPPED":
      return "Nadana";
    case "SHIPPING_CHANGED":
      return "Zmiana nadania";
    case "CANCELLED":
      return "Anulowana";
    case "CANCELLED_AFTER_SHIPPED":
      return "Anulowana po nadaniu";
    case "PICKED_UP":
      return "Odebrana";
    default:
      return status;
  }
}

function StatusChip({ status }: { status: string }) {
  return <Chip label={statusLabel(status)} variant="outlined" size="small" />;
}

function fmt(dt?: string | null) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

function errText(e: any, fallback: string) {
  const msg = e?.message ?? fallback;
  return String(msg);
}

export default function ReceptionHome() {
  const { instance, accounts } = useMsal();

  // ==========================
  // TABS
  // ==========================
  const [tab, setTab] = useState<0 | 1>(0);

  // ==========================
  // CREATE OUTGOING DIALOG
  // ==========================
  const [openCreate, setOpenCreate] = useState(false);
  const [openSuccess, setOpenSuccess] = useState(false);
  const [successInternalNo, setSuccessInternalNo] = useState("");

  const onCreated = (internalNo: string) => {
    setSuccessInternalNo(internalNo);
    setOpenSuccess(true);
    setOpenCreate(false);
    loadShipments();
  };

  // ==========================
  // OUTGOING (TAB 0)
  // ==========================
  const [items, setItems] = useState<ShipmentOut[]>([]);
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");

  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<number | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => items.find((x) => x.id === selectedId) ?? null,
    [items, selectedId]
  );

  // carriers
  const [carriers, setCarriers] = useState<SimpleDictItem[]>([]);
  const [carriersLoading, setCarriersLoading] = useState(false);

  // ship form in detail
  const [carrierId, setCarrierId] = useState("");
  const [trackingNo, setTrackingNo] = useState("");

  // ship form "editing lock"
  const [shipDraftDirty, setShipDraftDirty] = useState(false);
  const [shipFieldsFocused, setShipFieldsFocused] = useState(false);
  const shipDraftDirtyRef = useRef(false);
  const shipFieldsFocusedRef = useRef(false);

  useEffect(() => {
    shipDraftDirtyRef.current = shipDraftDirty;
  }, [shipDraftDirty]);

  useEffect(() => {
    shipFieldsFocusedRef.current = shipFieldsFocused;
  }, [shipFieldsFocused]);

  const recomputeShipDraftDirty = (nextCarrierId: string, nextTrackingNo: string) => {
    if (!selected) return;
    const baseCarrier = selected.carrier_id ?? "";
    const baseTracking = selected.carrier_tracking_no ?? "";
    setShipDraftDirty(nextCarrierId !== baseCarrier || nextTrackingNo !== baseTracking);
  };

  // messages
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [receiveLoading, setReceiveLoading] = useState(false);
  const [shipLoading, setShipLoading] = useState(false);
  const [changeShippingLoading, setChangeShippingLoading] = useState(false);
  const [changeShippingMode, setChangeShippingMode] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  // export loading
  const [exportOutgoingLoading, setExportOutgoingLoading] = useState(false);
  const [exportIncomingLoading, setExportIncomingLoading] = useState(false);

  const downloadXlsx = async (path: string) => {
    const resp = await fetchWithAuth(instance, accounts, path, { method: "GET" });
    const cd = resp.headers.get("content-disposition") || "";
    let filename = "";
    const m = cd.match(/filename="?([^"]+)"?/i);
    if (m && m[1]) filename = m[1];

    const blob = await resp.blob();
    const a = document.createElement("a");
    a.href = window.URL.createObjectURL(blob);
    a.download = filename || "export.xlsx";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(a.href);
  };

  const exportOutgoing = async () => {
    setExportOutgoingLoading(true);
    setError(null);
    setInfo(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", "5000");
      if (status) params.set("status", status);
      if (q.trim()) params.set("q", q.trim());
      await downloadXlsx(`/reception/export/outgoing.xlsx?${params.toString()}`);
      setInfo("✅ Wyeksportowano: Outgoing (Wychodzące) do Excel.");
    } catch (e: any) {
      setError(errText(e, "Nie udało się wyeksportować Outgoing do Excel."));
    } finally {
      setExportOutgoingLoading(false);
    }
  };

  const exportIncoming = async () => {
    setExportIncomingLoading(true);
    setError(null);
    setInfo(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", "5000");
      if (incomingStatus) params.set("status", incomingStatus);
      if (incomingQ.trim()) params.set("q", incomingQ.trim());
      await downloadXlsx(`/reception/export/incoming.xlsx?${params.toString()}`);
      setInfo("✅ Wyeksportowano: Incoming (Przychodzące) do Excel.");
    } catch (e: any) {
      setError(errText(e, "Nie udało się wyeksportować Incoming do Excel."));
    } finally {
      setExportIncomingLoading(false);
    }
  };

  const loadCarriers = async () => {
    setCarriersLoading(true);
    try {
      const data = await apiGetJson<SimpleDictItem[]>(instance, accounts, "/carriers");
      setCarriers(data);
    } catch (e: any) {
      setError(errText(e, "Nie udało się pobrać listy firm kurierskich."));
    } finally {
      setCarriersLoading(false);
    }
  };

  const loadShipments = async (silent?: boolean) => {
    if (!silent) {
      setLoading(true);
      setError(null);
      setInfo(null);
    }

    try {
      const params = new URLSearchParams();
      params.set("limit", "200");
      if (status) params.set("status", status);
      if (q.trim()) params.set("q", q.trim());

      const data = await apiGetJson<ShipmentOut[]>(instance, accounts, `/shipments?${params.toString()}`);

      setItems(data);

      if (!selectedId && data.length > 0) setSelectedId(data[0].id);
      if (selectedId && !data.some((x) => x.id === selectedId)) {
        setSelectedId(data.length > 0 ? data[0].id : null);
      }
    } catch (e: any) {
      if (!silent) setError(errText(e, "Nie udało się pobrać listy przesyłek."));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadCarriers();
    loadShipments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (tab === 0 && autoRefresh) {
      intervalRef.current = window.setInterval(() => {
        if (openCreate || openSuccess) return;
        if (shipFieldsFocusedRef.current || shipDraftDirtyRef.current) return;
        loadShipments(true);
      }, 10_000);
    }

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, q, status, selectedId, tab, openCreate, openSuccess]);

  useEffect(() => {
    if (!selected) return;
    setCarrierId(selected.carrier_id ?? "");
    setTrackingNo(selected.carrier_tracking_no ?? "");
    setShipDraftDirty(false);
    setChangeShippingMode(false);
  }, [selected]);

  const isShippingChanged = selected?.status === "SHIPPING_CHANGED";

  const isShipped =
    selected?.status === "SHIPPED" ||
    selected?.status === "SHIPPING_CHANGED" ||
    selected?.status === "CANCELLED_AFTER_SHIPPED";

  const isCancelled =
    selected?.status === "CANCELLED" ||
    selected?.status === "CANCELLED_AFTER_SHIPPED";

  const canChangeShipping =
    !!selected && (selected.status === "SHIPPED" || selected.status === "SHIPPING_CHANGED");

  const shippingFieldsDisabled =
    isCancelled || (canChangeShipping && !changeShippingMode);

  const canReceive =
    !!selected &&
    !isShipped &&
    !isCancelled &&
    selected.status !== "AT_RECEPTION";

  const canCancel = useMemo(() => {
    if (!selected) return false;
    if (isCancelled) return false;
    return true;
  }, [selected, isCancelled]);

  const canShip = useMemo(() => {
    if (!selected) return false;
    if (isCancelled) return false;
    if (canChangeShipping) return false;
    return carrierId.trim().length > 0 && trackingNo.trim().length >= 4;
  }, [selected, carrierId, trackingNo, isCancelled, canChangeShipping]);

  const canSaveShippingChange = useMemo(() => {
    if (!selected) return false;
    if (!canChangeShipping) return false;
    if (!changeShippingMode) return false;
    if (!shipDraftDirty) return false;
    return carrierId.trim().length > 0 && trackingNo.trim().length >= 2;
  }, [selected, canChangeShipping, changeShippingMode, shipDraftDirty, carrierId, trackingNo]);

  const receive = async () => {
    if (!selected) return;
    setReceiveLoading(true);
    setError(null);
    setInfo(null);
    try {
      const updated = await apiPostJson<ShipmentOut, {}>(instance, accounts, `/shipments/${selected.id}/receive`, {});
      setInfo("✅ Oznaczono jako: przyjęta fizycznie na recepcji.");
      setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e: any) {
      setError(errText(e, "Nie udało się zmienić statusu na AT_RECEPTION."));
    } finally {
      setReceiveLoading(false);
    }
  };

  const ship = async () => {
    if (!selected) return;
    setShipLoading(true);
    setError(null);
    setInfo(null);
    try {
      const payload = {
        carrier_id: carrierId,
        carrier_tracking_no: trackingNo.trim(),
      };
      const updated = await apiPostJson<ShipmentOut, typeof payload>(
        instance,
        accounts,
        `/shipments/${selected.id}/ship`,
        payload
      );
      setInfo("✅ Przesyłka została oznaczona jako: NADANA (SHIPPED).");
      setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setShipDraftDirty(false);
      setShipFieldsFocused(false);
    } catch (e: any) {
      setError(errText(e, "Nie udało się nadać przesyłki."));
    } finally {
      setShipLoading(false);
    }
  };

  const startShippingChange = () => {
    if (!selected) return;
    setCarrierId(selected.carrier_id ?? "");
    setTrackingNo(selected.carrier_tracking_no ?? "");
    setShipDraftDirty(false);
    setChangeShippingMode(true);
  };

  const abortShippingChange = () => {
    if (!selected) return;
    setCarrierId(selected.carrier_id ?? "");
    setTrackingNo(selected.carrier_tracking_no ?? "");
    setShipDraftDirty(false);
    setShipFieldsFocused(false);
    setChangeShippingMode(false);
  };

  const changeShipping = async () => {
    if (!selected) return;
    setChangeShippingLoading(true);
    setError(null);
    setInfo(null);
    try {
      const payload = {
        carrier_id: carrierId,
        carrier_tracking_no: trackingNo.trim(),
      };
      const updated = await apiPostJson<ShipmentOut, typeof payload>(
        instance,
        accounts,
        `/shipments/${selected.id}/change-shipping`,
        payload
      );
      setInfo("✅ Zmieniono dane nadania. Poprzedni kurier i tracking zostały zapisane w historii.");
      setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setShipDraftDirty(false);
      setShipFieldsFocused(false);
      setChangeShippingMode(false);
    } catch (e: any) {
      setError(errText(e, "Nie udało się zmienić danych nadania."));
    } finally {
      setChangeShippingLoading(false);
    }
  };

  const cancel = async () => {
    if (!selected) return;
    setCancelLoading(true);
    setError(null);
    setInfo(null);
    try {
      const updated = await apiPostJson<ShipmentOut, {}>(instance, accounts, `/shipments/${selected.id}/cancel`, {});
      setInfo(
        updated.status === "CANCELLED_AFTER_SHIPPED"
          ? "✅ Przesyłka została anulowana po nadaniu."
          : "✅ Zlecenie zostało anulowane."
      );
      setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e: any) {
      setError(errText(e, "Nie udało się anulować zlecenia."));
    } finally {
      setCancelLoading(false);
    }
  };

  const costCenterLabel = (s: ShipmentOut) => {
    const code = s.cost_center_code?.trim();
    const name = s.cost_center_name?.trim();
    if (code && name) return `${code} — ${name}`;
    if (code) return code;
    if (name) return name;
    return s.cost_center_id || "—";
  };

  const requestedByLabel = (s: ShipmentOut) =>
    s.requested_by_name?.trim() || s.requested_by_upn?.trim() || "—";

  // ==========================
  // INCOMING (TAB 1)
  // ==========================
  const [incomingItems, setIncomingItems] = useState<IncomingShipmentOut[]>([]);
  const [incomingLoading, setIncomingLoading] = useState(false);

  const [incomingQ, setIncomingQ] = useState("");
  const [incomingStatus, setIncomingStatus] = useState<string>("");

  const [incomingSelectedId, setIncomingSelectedId] = useState<string | null>(null);
  const incomingSelected = useMemo(
    () => incomingItems.find((x) => x.id === incomingSelectedId) ?? null,
    [incomingItems, incomingSelectedId]
  );

  const [inCarrierId, setInCarrierId] = useState<string>("");
  const [inTrackingNo, setInTrackingNo] = useState<string>("");
  const [inSenderName, setInSenderName] = useState<string>("");
  const [inContents, setInContents] = useState<string>("");

  // register recipient
  const [userQuery, setUserQuery] = useState("");
  const [usersLoading, setUsersLoading] = useState(false);
  const [users, setUsers] = useState<GraphUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<GraphUser | null>(null);

  const [inRecipientUpn, setInRecipientUpn] = useState<string>("");
  const [inRecipientName, setInRecipientName] = useState<string>("");

  const [incomingRegisterLoading, setIncomingRegisterLoading] = useState(false);
  const [incomingPickedUpLoading, setIncomingPickedUpLoading] = useState(false);

  // edit recipient
  const [editUserQuery, setEditUserQuery] = useState("");
  const [editUsersLoading, setEditUsersLoading] = useState(false);
  const [editUsers, setEditUsers] = useState<GraphUser[]>([]);
  const [editSelectedUser, setEditSelectedUser] = useState<GraphUser | null>(null);
  const [editRecipientUpn, setEditRecipientUpn] = useState<string>("");
  const [editRecipientName, setEditRecipientName] = useState<string>("");
  const [changeRecipientLoading, setChangeRecipientLoading] = useState(false);

  const loadIncoming = async () => {
    setIncomingLoading(true);
    setError(null);
    setInfo(null);

    try {
      const params = new URLSearchParams();
      params.set("limit", "200");
      if (incomingStatus) params.set("status", incomingStatus);
      if (incomingQ.trim()) params.set("q", incomingQ.trim());

      const data = await apiGetJson<IncomingShipmentOut[]>(
        instance,
        accounts,
        `/incoming-shipments?${params.toString()}`
      );

      setIncomingItems(data);

      if (!incomingSelectedId && data.length > 0) setIncomingSelectedId(data[0].id);
      if (incomingSelectedId && !data.some((x) => x.id === incomingSelectedId)) {
        setIncomingSelectedId(data.length > 0 ? data[0].id : null);
      }
    } catch (e: any) {
      setError(errText(e, "Nie udało się pobrać listy przesyłek przychodzących."));
    } finally {
      setIncomingLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 1 && incomingItems.length === 0) {
      loadIncoming();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const getGraphToken = async (): Promise<string> => {
    const account = instance.getActiveAccount() ?? accounts?.[0];
    if (!account) throw new Error("Brak konta MSAL (użytkownik niezalogowany).");

    try {
      const result = await instance.acquireTokenSilent({
        account,
        scopes: ["User.Read.All", "Group.Read.All"],
      });
      return result.accessToken;
    } catch (e: any) {
      if (e instanceof InteractionRequiredAuthError) {
        await instance.acquireTokenRedirect({
          account,
          scopes: ["User.Read.All", "Group.Read.All"],
        });
      }
      throw e;
    }
  };

  const graphSearchUsers = async (query: string, target: "register" | "edit") => {
    const qx = query.trim();

    if (qx.length < 2) {
      if (target === "register") setUsers([]);
      else setEditUsers([]);
      return;
    }

    if (target === "register") setUsersLoading(true);
    else setEditUsersLoading(true);

    try {
      const token = await getGraphToken();

      const headers = {
        Authorization: `Bearer ${token}`,
        ConsistencyLevel: "eventual",
      };

      const results: GraphUser[] = [];

      // USERS — tylko użytkownicy z odblokowanym logowaniem + Member, bez Guestów.
      const userSearchExpr = `"displayName:${qx}" OR "userPrincipalName:${qx}" OR "mail:${qx}"`;
      const usersUrl =
        `https://graph.microsoft.com/v1.0/users` +
        `?$select=id,displayName,userPrincipalName,mail,accountEnabled,userType` +
        `&$filter=accountEnabled eq true and userType eq 'Member'` +
        `&$top=25` +
        `&$count=true` +
        `&$search=${encodeURIComponent(userSearchExpr)}`;

      const usersResp = await fetch(usersUrl, {
        method: "GET",
        headers,
      });

      if (!usersResp.ok) {
        const txt = await usersResp.text().catch(() => "");
        throw new Error(`Graph users ${usersResp.status}: ${txt || usersResp.statusText}`);
      }

      const usersData = (await usersResp.json()) as { value?: GraphUser[] };

      for (const u of usersData.value || []) {
        const email = (u.mail || u.userPrincipalName || "").trim();
        const name = (u.displayName || email).trim();

        if (!email) continue;

        results.push({
          ...u,
          type: "user",
          label: `👤 ${name} • ${email}`,
        });
      }

      // GROUPS + LISTY DYSTRYBUCYJNE — tylko obiekty mail-enabled.
      const groupSearchExpr = `"displayName:${qx}" OR "mail:${qx}"`;
      const groupsUrl =
        `https://graph.microsoft.com/v1.0/groups` +
        `?$select=id,displayName,mail,mailEnabled,securityEnabled,groupTypes` +
        `&$filter=mailEnabled eq true` +
        `&$top=25` +
        `&$count=true` +
        `&$search=${encodeURIComponent(groupSearchExpr)}`;

      const groupsResp = await fetch(groupsUrl, {
        method: "GET",
        headers,
      });

      if (!groupsResp.ok) {
        const txt = await groupsResp.text().catch(() => "");
        throw new Error(`Graph groups ${groupsResp.status}: ${txt || groupsResp.statusText}`);
      }

      const groupsData = (await groupsResp.json()) as { value?: any[] };

      for (const g of groupsData.value || []) {
        const mail = (g.mail || "").trim();
        const name = (g.displayName || mail).trim();

        if (!mail) continue;

        const groupTypes = g.groupTypes || [];
        const mailEnabled = Boolean(g.mailEnabled);
        const securityEnabled = Boolean(g.securityEnabled);

        let type: GraphUser["type"] = "distribution_list";
        let icon = "📧";
        let typeLabel = "Lista dystrybucyjna";

        if (groupTypes.includes("Unified")) {
          type = "m365_group";
          icon = "👥";
          typeLabel = "Grupa M365";
        } else if (mailEnabled && securityEnabled) {
          type = "mail_security_group";
          icon = "🔐";
          typeLabel = "Grupa mail/security";
        }

        results.push({
          id: g.id,
          type,
          displayName: name,
          userPrincipalName: null,
          mail,
          label: `${icon} ${name} • ${mail} • ${typeLabel}`,
        });
      }

      // Deduplikacja po mail/UPN/id.
      const unique = new Map<string, GraphUser>();

      for (const r of results) {
        const key = (r.mail || r.userPrincipalName || r.id || "").toLowerCase();
        if (!key) continue;
        unique.set(key, r);
      }

      const finalResults = Array.from(unique.values()).slice(0, 50);

      if (target === "register") setUsers(finalResults);
      else setEditUsers(finalResults);
    } finally {
      if (target === "register") setUsersLoading(false);
      else setEditUsersLoading(false);
    }
  };

  const userSearchTimer = useRef<number | null>(null);
  useEffect(() => {
    if (tab !== 1) return;

    if (userSearchTimer.current) {
      window.clearTimeout(userSearchTimer.current);
      userSearchTimer.current = null;
    }
    userSearchTimer.current = window.setTimeout(() => {
      graphSearchUsers(userQuery, "register").catch((e: any) => {
        setError(errText(e, "Nie udało się pobrać listy użytkowników z Entra/Graph."));
      });
    }, 350);

    return () => {
      if (userSearchTimer.current) window.clearTimeout(userSearchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userQuery, tab]);

  const editUserSearchTimer = useRef<number | null>(null);
  useEffect(() => {
    if (tab !== 1) return;

    if (editUserSearchTimer.current) {
      window.clearTimeout(editUserSearchTimer.current);
      editUserSearchTimer.current = null;
    }
    editUserSearchTimer.current = window.setTimeout(() => {
      graphSearchUsers(editUserQuery, "edit").catch((e: any) => {
        setError(errText(e, "Nie udało się pobrać listy użytkowników z Entra/Graph."));
      });
    }, 350);

    return () => {
      if (editUserSearchTimer.current) window.clearTimeout(editUserSearchTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editUserQuery, tab]);

  useEffect(() => {
    if (!selectedUser) return;
    const upn = (selectedUser.userPrincipalName || selectedUser.mail || "").trim();
    const name = (selectedUser.displayName || "").trim();
    setInRecipientUpn(upn);
    setInRecipientName(name);
  }, [selectedUser]);

  useEffect(() => {
    if (!editSelectedUser) return;
    const upn = (editSelectedUser.userPrincipalName || editSelectedUser.mail || "").trim();
    const name = (editSelectedUser.displayName || "").trim();
    setEditRecipientUpn(upn);
    setEditRecipientName(name);
  }, [editSelectedUser]);

  useEffect(() => {
    if (!incomingSelected) return;
    setEditRecipientUpn(incomingSelected.recipient_upn || "");
    setEditRecipientName(incomingSelected.recipient_name || "");
    setEditSelectedUser(null);
    setEditUserQuery("");
    setEditUsers([]);
  }, [incomingSelected]);

  const canRegisterIncoming = useMemo(() => {
    return (
      inTrackingNo.trim().length >= 4 &&
      inSenderName.trim().length >= 2 &&
      inRecipientUpn.trim().length >= 3 &&
      inRecipientName.trim().length >= 2
    );
  }, [inTrackingNo, inSenderName, inRecipientUpn, inRecipientName]);

  const registerIncoming = async () => {
    setIncomingRegisterLoading(true);
    setError(null);
    setInfo(null);

    try {
      const payload: IncomingShipmentCreate = {
        carrier_id: inCarrierId.trim() ? inCarrierId : null,
        carrier_tracking_no: inTrackingNo.trim(),
        sender_name: inSenderName.trim(),
        recipient_upn: inRecipientUpn.trim(),
        recipient_name: inRecipientName.trim(),
        contents: inContents.trim() ? inContents.trim() : null,
      };

      const created = await apiPostJson<IncomingShipmentOut, IncomingShipmentCreate>(
        instance,
        accounts,
        `/incoming-shipments`,
        payload
      );

      setInfo("✅ Zarejestrowano paczkę przychodzącą na recepcji.");
      setIncomingItems((prev) => [created, ...prev]);

      setInCarrierId("");
      setInTrackingNo("");
      setInSenderName("");
      setInContents("");
      setSelectedUser(null);
      setInRecipientUpn("");
      setInRecipientName("");
      setUserQuery("");
      setUsers([]);

      setIncomingSelectedId(created.id);
    } catch (e: any) {
      setError(errText(e, "Nie udało się zarejestrować paczki przychodzącej."));
    } finally {
      setIncomingRegisterLoading(false);
    }
  };

  const markPickedUp = async () => {
    if (!incomingSelected) return;
    setIncomingPickedUpLoading(true);
    setError(null);
    setInfo(null);

    try {
      const updated = await apiPostJson<IncomingShipmentOut, {}>(
        instance,
        accounts,
        `/incoming-shipments/${incomingSelected.id}/picked-up`,
        {}
      );

      setInfo("✅ Oznaczono paczkę przychodzącą jako: ODEBRANA.");
      setIncomingItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (e: any) {
      setError(errText(e, "Nie udało się oznaczyć jako odebrana."));
    } finally {
      setIncomingPickedUpLoading(false);
    }
  };

  const incomingCanPickUp = useMemo(() => {
    if (!incomingSelected) return false;
    if (incomingSelected.status === "PICKED_UP") return false;
    if (incomingSelected.status === "CANCELLED") return false;
    return true;
  }, [incomingSelected]);

  const incomingCanChangeRecipient = useMemo(() => {
    if (!incomingSelected) return false;
    return incomingSelected.status === "AT_RECEPTION";
  }, [incomingSelected]);

  const recipientDirty = useMemo(() => {
    if (!incomingSelected) return false;
    const baseUpn = (incomingSelected.recipient_upn || "").trim();
    const baseName = (incomingSelected.recipient_name || "").trim();
    return editRecipientUpn.trim() !== baseUpn || editRecipientName.trim() !== baseName;
  }, [incomingSelected, editRecipientUpn, editRecipientName]);

  const canSaveRecipientChange = useMemo(() => {
    if (!incomingSelected) return false;
    if (!incomingCanChangeRecipient) return false;
    return recipientDirty && editRecipientUpn.trim().length >= 3 && editRecipientName.trim().length >= 2;
  }, [incomingSelected, incomingCanChangeRecipient, recipientDirty, editRecipientUpn, editRecipientName]);

  const changeRecipient = async () => {
    if (!incomingSelected) return;
    setChangeRecipientLoading(true);
    setError(null);
    setInfo(null);

    try {
      const payload = {
        recipient_upn: editRecipientUpn.trim(),
        recipient_name: editRecipientName.trim(),
      };

      const updated = await apiPostJson<IncomingShipmentOut, typeof payload>(
        instance,
        accounts,
        `/incoming-shipments/${incomingSelected.id}/change-recipient`,
        payload
      );

      setInfo("✅ Zmieniono odbiorcę paczki przychodzącej.");
      setIncomingItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));

      setEditRecipientUpn(updated.recipient_upn || "");
      setEditRecipientName(updated.recipient_name || "");
      setEditSelectedUser(null);
      setEditUserQuery("");
      setEditUsers([]);
    } catch (e: any) {
      setError(errText(e, "Nie udało się zmienić odbiorcy."));
    } finally {
      setChangeRecipientLoading(false);
    }
  };

  const incomingUserLabel = (u: GraphUser) => {
    if (u.label) return u.label;

    const name = (u.displayName || "").trim();
    const upn = (u.userPrincipalName || u.mail || "").trim();

    if (name && upn) return `${name} • ${upn}`;
    return name || upn || "—";
  };

  return (
    <AppShell title="Courier Registry • Recepcja">
      <Card
        elevation={0}
        sx={{
          borderRadius: 4,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(17, 24, 39, 0.62)",
          backdropFilter: "blur(14px)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
          color: "rgba(255,255,255,0.92)",
          overflow: "hidden",
          height: { xs: "auto", md: "calc(100dvh - 120px)" },
          minHeight: { xs: "auto", md: 640 },
        }}
      >
        <CardContent
          sx={{
            p: { xs: 2, md: 2.5 },
            height: { xs: "auto", md: "100%" },
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <Stack spacing={1.4} sx={{ height: "100%", minHeight: 0 }}>
            {/* HEADER */}
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1.2}
              alignItems={{ xs: "flex-start", md: "center" }}
              justifyContent="space-between"
            >
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 900, color: "rgba(255,255,255,0.92)" }}>
                  Panel recepcji
                </Typography>
                <Typography sx={{ opacity: 0.78, color: "rgba(255,255,255,0.85)" }}>
                  Obsługa przesyłek wychodzących i przychodzących.
                </Typography>
              </Box>

              {tab === 0 && (
                <Button
                  variant="contained"
                  onClick={() => setOpenCreate(true)}
                  sx={{ minWidth: 220, alignSelf: { xs: "stretch", md: "auto" } }}
                >
                  Utwórz nowe zlecenie
                </Button>
              )}
            </Stack>

            <Tabs
              value={tab}
              onChange={(_, v) => setTab(v)}
              sx={{
                "& .MuiTab-root": { color: "rgba(255,255,255,0.75)", fontWeight: 800, py: 1 },
                "& .Mui-selected": { color: "rgba(255,255,255,0.95)" },
                "& .MuiTabs-indicator": { backgroundColor: "rgba(255,255,255,0.85)" },
                minHeight: 42,
              }}
            >
              <Tab label="Outgoing (Wychodzące)" value={0} />
              <Tab label="Incoming (Przychodzące)" value={1} />
            </Tabs>

            <Box sx={{ flex: "0 0 auto" }}>
              {info && <Alert severity="success">{info}</Alert>}
              {error && <Alert severity="error">{error}</Alert>}
              {carriersLoading && <Alert severity="info">Ładowanie przewoźników…</Alert>}
            </Box>

            <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
              {tab === 0 && (
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={2}
                  alignItems="stretch"
                  sx={{ height: "100%", minHeight: 0 }}
                >
                  <Box sx={{ flex: 1.1, minWidth: 360, display: "flex", flexDirection: "column", minHeight: 0 }}>
                    <Stack spacing={1.2} sx={{ minHeight: 0, height: "100%" }}>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} alignItems="stretch">
                        <TextField
                          label="Szukaj (numer/adresat/email/tel/adres)"
                          value={q}
                          onChange={(e) => setQ(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") loadShipments();
                          }}
                          fullWidth
                          InputLabelProps={{ sx: { color: "rgba(255,255,255,0.75)" } }}
                          sx={{
                            "& .MuiInputBase-input": { color: "rgba(255,255,255,0.92)" },
                            "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.18)" },
                            "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.28)" },
                          }}
                        />

                        <FormControl sx={{ minWidth: 200, width: { xs: "100%", sm: 220 } }}>
                          <InputLabel id="status-label" sx={{ color: "rgba(255,255,255,0.75)" }}>
                            Status
                          </InputLabel>
                          <Select
                            labelId="status-label"
                            label="Status"
                            value={status}
                            onChange={(e) => setStatus(String(e.target.value))}
                            sx={{
                              color: "rgba(255,255,255,0.92)",
                              "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.18)" },
                            }}
                          >
                            <MenuItem value="">Wszystkie</MenuItem>
                            <MenuItem value="CREATED">Utworzona</MenuItem>
                            <MenuItem value="AT_RECEPTION">Na recepcji</MenuItem>
                            <MenuItem value="SHIPPED">Nadana</MenuItem>
                            <MenuItem value="SHIPPING_CHANGED">Zmiana nadania</MenuItem>
                            <MenuItem value="CANCELLED">Anulowana</MenuItem>
                            <MenuItem value="CANCELLED_AFTER_SHIPPED">Anulowana po nadaniu</MenuItem>
                          </Select>
                        </FormControl>

                        <Stack
                          spacing={0.8}
                          sx={{
                            flex: "0 0 auto",
                            width: { xs: "100%", sm: 160 },
                            minWidth: { xs: "100%", sm: 160 },
                          }}
                        >
                          <Button
                            variant="outlined"
                            onClick={() => loadShipments()}
                            size="small"
                            sx={{ width: "100%", py: 0.8, fontSize: 12, minHeight: 34 }}
                          >
                            Filtruj
                          </Button>

                          <Button
                            variant="outlined"
                            onClick={exportOutgoing}
                            disabled={exportOutgoingLoading}
                            size="small"
                            sx={{ width: "100%", py: 0.8, fontSize: 12, minHeight: 34 }}
                          >
                            {exportOutgoingLoading ? <CircularProgress size={18} /> : "Export Excel"}
                          </Button>
                        </Stack>
                      </Stack>

                      <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                        <FormControlLabel
                          control={<Switch checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />}
                          label={
                            <Typography sx={{ opacity: 0.85, color: "rgba(255,255,255,0.88)" }}>
                              Auto-odświeżanie co 10s
                            </Typography>
                          }
                        />
                        <Typography sx={{ opacity: 0.7, fontSize: 12, color: "rgba(255,255,255,0.82)" }}>
                          {autoRefresh
                            ? openCreate || openSuccess
                              ? "Wstrzymane (dialog)"
                              : shipFieldsFocused || shipDraftDirty
                              ? "Wstrzymane (edycja nadania)"
                              : "Włączone"
                            : "Wyłączone"}
                        </Typography>
                      </Stack>

                      <Box
                        sx={{
                          borderRadius: 3,
                          border: "1px solid rgba(255,255,255,0.10)",
                          background: "rgba(0,0,0,0.18)",
                          overflow: "hidden",
                          display: "flex",
                          flexDirection: "column",
                          flex: 1,
                          minHeight: 0,
                        }}
                      >
                        <Box
                          sx={{
                            px: 2,
                            py: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flex: "0 0 auto",
                          }}
                        >
                          <Typography sx={{ fontWeight: 800, opacity: 0.92, color: "rgba(255,255,255,0.92)" }}>
                            Przesyłki ({items.length})
                          </Typography>
                          {loading && <CircularProgress size={20} />}
                        </Box>
                        <Divider sx={{ opacity: 0.12 }} />

                        <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                          {!loading && items.length === 0 ? (
                            <Box sx={{ p: 2 }}>
                              <Alert severity="info">Nie znaleziono przesyłek dla podanych filtrów.</Alert>
                            </Box>
                          ) : (
                            <Stack spacing={0} divider={<Divider sx={{ opacity: 0.08 }} />}>
                              {items.map((s) => {
                                const isActive = s.id === selectedId;
                                return (
                                  <Box
                                    key={s.id}
                                    onClick={() => setSelectedId(s.id)}
                                    role="button"
                                    tabIndex={0}
                                    sx={{
                                      cursor: "pointer",
                                      px: 2,
                                      py: 1.1,
                                      background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                                      "&:hover": { background: "rgba(255,255,255,0.05)" },
                                    }}
                                  >
                                    <Stack direction="row" spacing={1.5} alignItems="center">
                                      <Box sx={{ minWidth: 180 }}>
                                        <Typography sx={{ fontWeight: 900, color: "rgba(255,255,255,0.92)" }}>
                                          {s.internal_no}
                                        </Typography>

                                        <Typography sx={{ opacity: 0.78, fontSize: 12, color: "rgba(255,255,255,0.82)" }}>
                                          {s.recipient_name}
                                        </Typography>

                                        <Typography
                                          sx={{ opacity: 0.68, fontSize: 11, color: "rgba(255,255,255,0.78)" }}
                                          noWrap
                                        >
                                          Utworzył: {requestedByLabel(s)}
                                        </Typography>
                                        <Typography
                                          sx={{ opacity: 0.66, fontSize: 11, color: "rgba(255,255,255,0.74)" }}
                                          noWrap
                                        >
                                          CC: {costCenterLabel(s)}
                                        </Typography>
                                      </Box>

                                      <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography sx={{ opacity: 0.88, fontSize: 12, color: "rgba(255,255,255,0.86)" }} noWrap>
                                          {s.recipient_email} • {s.recipient_phone}
                                        </Typography>
                                        <Typography sx={{ opacity: 0.74, fontSize: 12, color: "rgba(255,255,255,0.80)" }} noWrap>
                                          {s.recipient_street}, {s.recipient_postal_code} {s.recipient_city}
                                        </Typography>
                                      </Box>

                                      <StatusChip status={s.status} />
                                    </Stack>
                                  </Box>
                                );
                              })}
                            </Stack>
                          )}
                        </Box>
                      </Box>
                    </Stack>
                  </Box>

                  <Box sx={{ flex: 1, minWidth: 360, display: "flex", flexDirection: "column", minHeight: 0 }}>
                    {!selected ? (
                      <Box
                        sx={{
                          borderRadius: 3,
                          border: "1px solid rgba(255,255,255,0.10)",
                          background: "rgba(0,0,0,0.18)",
                          p: 3,
                          height: "100%",
                        }}
                      >
                        <Alert severity="info">Wybierz przesyłkę z listy, aby zobaczyć szczegóły.</Alert>
                      </Box>
                    ) : (
                      <Box
                        sx={{
                          borderRadius: 3,
                          border: "1px solid rgba(255,255,255,0.10)",
                          background: "rgba(0,0,0,0.18)",
                          p: 2.3,
                          height: "100%",
                          overflow: "auto",
                        }}
                      >
                        <Stack spacing={1.6}>
                          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                            <Box>
                              <Typography sx={{ fontWeight: 900, fontSize: 18, color: "rgba(255,255,255,0.92)" }}>
                                {selected.internal_no}
                              </Typography>
                              <Typography sx={{ opacity: 0.8, color: "rgba(255,255,255,0.86)" }}>
                                Status: <b>{statusLabel(selected.status)}</b>
                              </Typography>
                            </Box>
                            <StatusChip status={selected.status} />
                          </Stack>

                          <Divider sx={{ opacity: 0.12 }} />

                          <Box>
                            <Typography sx={{ opacity: 0.75, fontSize: 13, color: "rgba(255,255,255,0.82)" }}>
                              Utworzył
                            </Typography>
                            <Typography sx={{ fontWeight: 800, color: "rgba(255,255,255,0.92)" }}>
                              {selected.requested_by_name || "—"}
                            </Typography>
                            {selected.requested_by_upn && (
                              <Typography sx={{ opacity: 0.88, color: "rgba(255,255,255,0.88)" }}>
                                {selected.requested_by_upn}
                              </Typography>
                            )}
                          </Box>

                          <Box>
                            <Typography sx={{ opacity: 0.75, fontSize: 13, color: "rgba(255,255,255,0.82)" }}>
                              Centrum kosztowe
                            </Typography>
                            <Typography sx={{ fontWeight: 800, color: "rgba(255,255,255,0.92)" }}>
                              {costCenterLabel(selected)}
                            </Typography>
                          </Box>

                          <Box>
                            <Typography sx={{ opacity: 0.75, fontSize: 13, color: "rgba(255,255,255,0.82)" }}>
                              Adresat
                            </Typography>
                            <Typography sx={{ fontWeight: 800, color: "rgba(255,255,255,0.92)" }}>
                              {selected.recipient_name}
                            </Typography>
                            <Typography sx={{ opacity: 0.88, color: "rgba(255,255,255,0.88)" }}>
                              {selected.recipient_email} • {selected.recipient_phone}
                            </Typography>
                          </Box>

                          <Box>
                            <Typography sx={{ opacity: 0.75, fontSize: 13, color: "rgba(255,255,255,0.82)" }}>
                              Adres
                            </Typography>
                            <Typography sx={{ color: "rgba(255,255,255,0.90)" }}>
                              {selected.recipient_street}, {selected.recipient_postal_code} {selected.recipient_city},{" "}
                              {selected.recipient_country}
                            </Typography>
                          </Box>

                          <Box>
                            <Typography sx={{ opacity: 0.75, fontSize: 13, color: "rgba(255,255,255,0.82)" }}>
                              Zawartość
                            </Typography>
                            <Typography sx={{ whiteSpace: "pre-wrap", color: "rgba(255,255,255,0.90)" }}>
                              {selected.contents}
                            </Typography>
                          </Box>

                          {(selected.vin || selected.plate_no) && (
                            <Box>
                              <Typography sx={{ opacity: 0.75, fontSize: 13, color: "rgba(255,255,255,0.82)" }}>
                                Dane opcjonalne
                              </Typography>
                              <Typography sx={{ color: "rgba(255,255,255,0.90)" }}>
                                {selected.vin ? `VIN: ${selected.vin}` : ""}
                                {selected.vin && selected.plate_no ? " • " : ""}
                                {selected.plate_no ? `REJ: ${selected.plate_no}` : ""}
                              </Typography>
                            </Box>
                          )}

                          <Divider sx={{ opacity: 0.12 }} />

                          <Stack spacing={1.2}>
                            <Typography sx={{ fontWeight: 800, color: "rgba(255,255,255,0.92)" }}>Akcje recepcji</Typography>

                            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                              <Button variant="outlined" disabled={!canReceive || receiveLoading} onClick={receive} sx={{ minWidth: 220 }}>
                                {receiveLoading ? <CircularProgress size={20} /> : "Przyjęta fizycznie"}
                              </Button>

                              <Typography sx={{ opacity: 0.78, alignSelf: "center", color: "rgba(255,255,255,0.86)" }}>
                                Ustawia status <b>AT_RECEPTION</b>
                              </Typography>
                            </Stack>

                            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mt: 0.5 }}>
                              <FormControl fullWidth disabled={shippingFieldsDisabled}>
                                <InputLabel id="carrier-label" sx={{ color: "rgba(255,255,255,0.75)" }}>
                                  Firma kurierska
                                </InputLabel>
                                <Select
                                  labelId="carrier-label"
                                  label="Firma kurierska"
                                  value={carrierId}
                                  onFocus={() => setShipFieldsFocused(true)}
                                  onBlur={() => setShipFieldsFocused(false)}
                                  onChange={(e) => {
                                    const v = String(e.target.value);
                                    setCarrierId(v);
                                    recomputeShipDraftDirty(v, trackingNo);
                                  }}
                                  sx={{
                                    color: "rgba(255,255,255,0.92)",
                                    "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.18)" },
                                  }}
                                >
                                  {carriers.map((c) => (
                                    <MenuItem key={c.id} value={c.id}>
                                      {c.name}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>

                              <TextField
                                label="Numer przesyłki (tracking)"
                                value={trackingNo}
                                onFocus={() => setShipFieldsFocused(true)}
                                onBlur={() => setShipFieldsFocused(false)}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setTrackingNo(v);
                                  recomputeShipDraftDirty(carrierId, v);
                                }}
                                fullWidth
                                helperText={
                                  canChangeShipping
                                    ? changeShippingMode
                                      ? "Możesz wpisać numer, nazwisko lub opis odbioru"
                                      : "Kliknij Zmień, aby edytować dane nadania"
                                    : "Wymagane do nadania"
                                }
                                disabled={shippingFieldsDisabled}
                                InputLabelProps={{ sx: { color: "rgba(255,255,255,0.75)" } }}
                                sx={{
                                  "& .MuiInputBase-input": { color: "rgba(255,255,255,0.92)" },
                                  "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.18)" },
                                }}
                              />
                            </Stack>

                            {canChangeShipping ? (
                              <Stack spacing={1.2}>
                                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
                                  {!changeShippingMode ? (
                                    <Button variant="outlined" onClick={startShippingChange} sx={{ minWidth: 180 }}>
                                      Zmień
                                    </Button>
                                  ) : (
                                    <>
                                      <Button
                                        variant="contained"
                                        onClick={changeShipping}
                                        disabled={!canSaveShippingChange || changeShippingLoading}
                                        sx={{ minWidth: 220 }}
                                      >
                                        {changeShippingLoading ? <CircularProgress size={20} /> : "Zapisz zmianę nadania"}
                                      </Button>

                                      <Button variant="outlined" onClick={abortShippingChange} disabled={changeShippingLoading} sx={{ minWidth: 120 }}>
                                        Cofnij
                                      </Button>
                                    </>
                                  )}

                                  <Typography sx={{ opacity: 0.78, color: "rgba(255,255,255,0.86)" }}>
                                    {isShippingChanged ? (
                                      <>Status: <b>Zmiana nadania</b>. Historia poprzednich danych jest zapisana.</>
                                    ) : changeShippingMode ? (
                                      <>Zmień firmę kurierską oraz numer/nazwisko w polu tracking.</>
                                    ) : (
                                      <>Przesyłka jest już <b>nadana</b>. Możesz zmienić dane nadania przyciskiem Zmień.</>
                                    )}
                                  </Typography>
                                </Stack>
                              </Stack>
                            ) : (
                              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
                                <Button variant="contained" onClick={ship} disabled={!canShip || shipLoading} sx={{ minWidth: 180 }}>
                                  {shipLoading ? <CircularProgress size={20} /> : "Nadaj"}
                                </Button>

                                {selected.status === "CANCELLED_AFTER_SHIPPED" ? (
                                  <Typography sx={{ opacity: 0.78, color: "rgba(255,255,255,0.86)" }}>
                                    Przesyłka jest <b>anulowana po nadaniu</b> — dane nadania są zablokowane.
                                  </Typography>
                                ) : !canShip ? (
                                  <Typography sx={{ opacity: 0.78, color: "rgba(255,255,255,0.86)" }}>
                                    Wybierz firmę kurierską i wpisz numer przesyłki, aby nadać.
                                  </Typography>
                                ) : null}
                              </Stack>
                            )}

                            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
                              <Button
                                variant="outlined"
                                color="error"
                                onClick={cancel}
                                disabled={!canCancel || cancelLoading}
                                sx={{ minWidth: 180 }}
                              >
                                {cancelLoading ? <CircularProgress size={20} /> : "Anuluj zlecenie"}
                              </Button>

                              {!canCancel && selected.status === "CANCELLED_AFTER_SHIPPED" && (
                                <Typography sx={{ opacity: 0.78, color: "rgba(255,255,255,0.86)" }}>
                                  Przesyłka została już <b>anulowana po nadaniu</b>.
                                </Typography>
                              )}
                            </Stack>

                            <Divider sx={{ opacity: 0.12 }} />

                            <Box>
                              <Typography sx={{ opacity: 0.78, fontSize: 13, color: "rgba(255,255,255,0.82)" }}>
                                Czasy
                              </Typography>
                              <Typography sx={{ opacity: 0.92, fontSize: 13, color: "rgba(255,255,255,0.90)" }}>
                                Utworzono: <b>{fmt(selected.created_at)}</b>
                              </Typography>
                              <Typography sx={{ opacity: 0.92, fontSize: 13, color: "rgba(255,255,255,0.90)" }}>
                                Przyjęto: <b>{fmt(selected.received_at)}</b>
                              </Typography>
                              <Typography sx={{ opacity: 0.92, fontSize: 13, color: "rgba(255,255,255,0.90)" }}>
                                Nadano: <b>{fmt(selected.shipped_at)}</b>
                              </Typography>
                              {selected.shipping_changed_at && (
                                <Typography sx={{ opacity: 0.92, fontSize: 13, color: "rgba(255,255,255,0.90)" }}>
                                  Zmieniono nadanie: <b>{fmt(selected.shipping_changed_at)}</b>
                                </Typography>
                              )}
                              {selected.cancelled_at && (
                                <Typography sx={{ opacity: 0.92, fontSize: 13, color: "rgba(255,255,255,0.90)" }}>
                                  Anulowano: <b>{fmt(selected.cancelled_at)}</b>
                                </Typography>
                              )}
                              {selected.cancelled_after_shipped_at && (
                                <Typography sx={{ opacity: 0.92, fontSize: 13, color: "rgba(255,255,255,0.90)" }}>
                                  Anulowano po nadaniu: <b>{fmt(selected.cancelled_after_shipped_at)}</b>
                                </Typography>
                              )}
                            </Box>
                          </Stack>
                        </Stack>
                      </Box>
                    )}
                  </Box>
                </Stack>
              )}

              {tab === 1 && (
                <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="stretch" sx={{ height: "100%", minHeight: 0 }}>
                  <Box
                    sx={{
                      flex: 1.1,
                      minWidth: 360,
                      minHeight: 0,
                      overflow: "auto",
                      pr: 0.5,
                    }}
                  >
                    <Stack spacing={1.5}>
                      <Box
                        sx={{
                          borderRadius: 3,
                          border: "1px solid rgba(255,255,255,0.10)",
                          background: "rgba(0,0,0,0.18)",
                          p: 2,
                        }}
                      >
                        <Stack spacing={1.4}>
                          <Typography sx={{ fontWeight: 900, color: "rgba(255,255,255,0.92)" }}>
                            Rejestracja paczki przychodzącej
                          </Typography>

                          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                            <FormControl fullWidth>
                              <InputLabel id="in-carrier-label" sx={{ color: "rgba(255,255,255,0.75)" }}>
                                Firma kurierska (opcjonalnie)
                              </InputLabel>
                              <Select
                                labelId="in-carrier-label"
                                label="Firma kurierska (opcjonalnie)"
                                value={inCarrierId}
                                onChange={(e) => setInCarrierId(String(e.target.value))}
                                sx={{
                                  color: "rgba(255,255,255,0.92)",
                                  "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.18)" },
                                }}
                              >
                                <MenuItem value="">—</MenuItem>
                                {carriers.map((c) => (
                                  <MenuItem key={c.id} value={c.id}>
                                    {c.name}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>

                            <TextField
                              label="Tracking"
                              value={inTrackingNo}
                              onChange={(e) => setInTrackingNo(e.target.value)}
                              fullWidth
                              InputLabelProps={{ sx: { color: "rgba(255,255,255,0.75)" } }}
                              sx={{
                                "& .MuiInputBase-input": { color: "rgba(255,255,255,0.92)" },
                                "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.18)" },
                              }}
                            />
                          </Stack>

                          <TextField
                            label="Nadawca"
                            value={inSenderName}
                            onChange={(e) => setInSenderName(e.target.value)}
                            fullWidth
                            InputLabelProps={{ sx: { color: "rgba(255,255,255,0.75)" } }}
                            sx={{
                              "& .MuiInputBase-input": { color: "rgba(255,255,255,0.92)" },
                              "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.18)" },
                            }}
                          />

                          <Autocomplete
                            options={users}
                            value={selectedUser}
                            onChange={(_, v) => setSelectedUser(v)}
                            getOptionLabel={(u) => incomingUserLabel(u)}
                            isOptionEqualToValue={(option, value) =>
                              (option.mail || option.userPrincipalName || option.id || "") ===
                              (value.mail || value.userPrincipalName || value.id || "")
                            }
                            filterOptions={(x) => x}
                            loading={usersLoading}
                            onInputChange={(_, v) => setUserQuery(v)}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                label="Odbiorca (UPN/email) — wyszukaj w Entra"
                                InputLabelProps={{ sx: { color: "rgba(255,255,255,0.75)" } }}
                                sx={{
                                  "& .MuiInputBase-input": { color: "rgba(255,255,255,0.92)" },
                                  "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.18)" },
                                }}
                                InputProps={{
                                  ...params.InputProps,
                                  endAdornment: (
                                    <>
                                      {usersLoading ? <CircularProgress size={18} /> : null}
                                      {params.InputProps.endAdornment}
                                    </>
                                  ),
                                }}
                              />
                            )}
                          />

                          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                            <TextField
                              label="Odbiorca UPN/email"
                              value={inRecipientUpn}
                              onChange={(e) => setInRecipientUpn(e.target.value)}
                              fullWidth
                              InputLabelProps={{ sx: { color: "rgba(255,255,255,0.75)" } }}
                              sx={{
                                "& .MuiInputBase-input": { color: "rgba(255,255,255,0.92)" },
                                "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.18)" },
                              }}
                            />

                            <TextField
                              label="Odbiorca imię i nazwisko"
                              value={inRecipientName}
                              onChange={(e) => setInRecipientName(e.target.value)}
                              fullWidth
                              InputLabelProps={{ sx: { color: "rgba(255,255,255,0.75)" } }}
                              sx={{
                                "& .MuiInputBase-input": { color: "rgba(255,255,255,0.92)" },
                                "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.18)" },
                              }}
                            />
                          </Stack>

                          <TextField
                            label="Zawartość (opcjonalnie)"
                            value={inContents}
                            onChange={(e) => setInContents(e.target.value)}
                            fullWidth
                            multiline
                            minRows={2}
                            InputLabelProps={{ sx: { color: "rgba(255,255,255,0.75)" } }}
                            sx={{
                              "& .MuiInputBase-input": { color: "rgba(255,255,255,0.92)" },
                              "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.18)" },
                            }}
                          />

                          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
                            <Button
                              variant="contained"
                              onClick={registerIncoming}
                              disabled={!canRegisterIncoming || incomingRegisterLoading}
                              sx={{ minWidth: 220 }}
                            >
                              {incomingRegisterLoading ? <CircularProgress size={20} /> : "Zarejestruj na recepcji"}
                            </Button>

                            {!canRegisterIncoming && (
                              <Typography sx={{ opacity: 0.78, color: "rgba(255,255,255,0.86)" }}>
                                Wymagane: tracking, nadawca, odbiorca (UPN) i imię/nazwisko.
                              </Typography>
                            )}
                          </Stack>
                        </Stack>
                      </Box>

                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="stretch">
                        <TextField
                          label="Szukaj (tracking/nadawca/odbiorca/upn/zawartość)"
                          value={incomingQ}
                          onChange={(e) => setIncomingQ(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") loadIncoming();
                          }}
                          fullWidth
                          InputLabelProps={{ sx: { color: "rgba(255,255,255,0.75)" } }}
                          sx={{
                            "& .MuiInputBase-input": { color: "rgba(255,255,255,0.92)" },
                            "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.18)" },
                          }}
                        />

                        <FormControl sx={{ minWidth: 210, width: { xs: "100%", sm: 230 } }}>
                          <InputLabel id="incoming-status-label" sx={{ color: "rgba(255,255,255,0.75)" }}>
                            Status
                          </InputLabel>
                          <Select
                            labelId="incoming-status-label"
                            label="Status"
                            value={incomingStatus}
                            onChange={(e) => setIncomingStatus(String(e.target.value))}
                            sx={{
                              color: "rgba(255,255,255,0.92)",
                              "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.18)" },
                            }}
                          >
                            <MenuItem value="">Wszystkie</MenuItem>
                            <MenuItem value="AT_RECEPTION">Na recepcji</MenuItem>
                            <MenuItem value="PICKED_UP">Odebrana</MenuItem>
                            <MenuItem value="CANCELLED">Anulowana</MenuItem>
                          </Select>
                        </FormControl>

                        <Stack
                          spacing={0.8}
                          sx={{
                            flex: "0 0 auto",
                            width: { xs: "100%", sm: 160 },
                            minWidth: { xs: "100%", sm: 160 },
                          }}
                        >
                          <Button
                            variant="outlined"
                            onClick={() => loadIncoming()}
                            size="small"
                            sx={{ width: "100%", py: 0.8, fontSize: 12, minHeight: 34 }}
                          >
                            Filtruj
                          </Button>

                          <Button
                            variant="outlined"
                            onClick={exportIncoming}
                            disabled={exportIncomingLoading}
                            size="small"
                            sx={{ width: "100%", py: 0.8, fontSize: 12, minHeight: 34 }}
                          >
                            {exportIncomingLoading ? <CircularProgress size={18} /> : "Export Excel"}
                          </Button>
                        </Stack>
                      </Stack>

                      <Box
                        sx={{
                          borderRadius: 3,
                          border: "1px solid rgba(255,255,255,0.10)",
                          background: "rgba(0,0,0,0.18)",
                          overflow: "hidden",
                        }}
                      >
                        <Box
                          sx={{
                            px: 2,
                            py: 1.2,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <Typography sx={{ fontWeight: 800, opacity: 0.92, color: "rgba(255,255,255,0.92)" }}>
                            Przychodzące ({incomingItems.length})
                          </Typography>
                          {incomingLoading && <CircularProgress size={20} />}
                        </Box>
                        <Divider sx={{ opacity: 0.12 }} />

                        <Box sx={{ maxHeight: 420, overflow: "auto" }}>
                          {!incomingLoading && incomingItems.length === 0 ? (
                            <Box sx={{ p: 2 }}>
                              <Alert severity="info">Brak paczek przychodzących dla podanych filtrów.</Alert>
                            </Box>
                          ) : (
                            <Stack spacing={0} divider={<Divider sx={{ opacity: 0.08 }} />}>
                              {incomingItems.map((x) => {
                                const isActive = x.id === incomingSelectedId;
                                return (
                                  <Box
                                    key={x.id}
                                    onClick={() => setIncomingSelectedId(x.id)}
                                    role="button"
                                    tabIndex={0}
                                    sx={{
                                      cursor: "pointer",
                                      px: 2,
                                      py: 1.1,
                                      background: isActive ? "rgba(255,255,255,0.08)" : "transparent",
                                      "&:hover": { background: "rgba(255,255,255,0.05)" },
                                    }}
                                  >
                                    <Stack direction="row" spacing={1.5} alignItems="center">
                                      <Box sx={{ minWidth: 180 }}>
                                        <Typography sx={{ fontWeight: 900, color: "rgba(255,255,255,0.92)" }}>
                                          {x.internal_no}
                                        </Typography>
                                        <Typography sx={{ opacity: 0.78, fontSize: 12, color: "rgba(255,255,255,0.82)" }}>
                                          {x.recipient_name}
                                        </Typography>
                                        <Typography sx={{ opacity: 0.70, fontSize: 11, color: "rgba(255,255,255,0.78)" }} noWrap>
                                          {x.recipient_upn}
                                        </Typography>
                                      </Box>

                                      <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography sx={{ opacity: 0.86, fontSize: 12, color: "rgba(255,255,255,0.86)" }} noWrap>
                                          {x.sender_name}
                                        </Typography>
                                        <Typography sx={{ opacity: 0.74, fontSize: 12, color: "rgba(255,255,255,0.80)" }} noWrap>
                                          {x.carrier_name ? `${x.carrier_name} • ` : ""}{x.carrier_tracking_no}
                                        </Typography>
                                      </Box>

                                      <StatusChip status={x.status} />
                                    </Stack>
                                  </Box>
                                );
                              })}
                            </Stack>
                          )}
                        </Box>
                      </Box>
                    </Stack>
                  </Box>

                  <Box sx={{ flex: 1, minWidth: 360, display: "flex", flexDirection: "column", minHeight: 0 }}>
                    {!incomingSelected ? (
                      <Box
                        sx={{
                          borderRadius: 3,
                          border: "1px solid rgba(255,255,255,0.10)",
                          background: "rgba(0,0,0,0.18)",
                          p: 3,
                          height: "100%",
                        }}
                      >
                        <Alert severity="info">Wybierz paczkę przychodzącą z listy, aby zobaczyć szczegóły.</Alert>
                      </Box>
                    ) : (
                      <Box
                        sx={{
                          borderRadius: 3,
                          border: "1px solid rgba(255,255,255,0.10)",
                          background: "rgba(0,0,0,0.18)",
                          p: 2.3,
                          height: "100%",
                          overflow: "auto",
                        }}
                      >
                        <Stack spacing={1.6}>
                          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                            <Box>
                              <Typography sx={{ fontWeight: 900, fontSize: 18, color: "rgba(255,255,255,0.92)" }}>
                                {incomingSelected.internal_no}
                              </Typography>
                              <Typography sx={{ opacity: 0.8, color: "rgba(255,255,255,0.86)" }}>
                                Status: <b>{statusLabel(incomingSelected.status)}</b>
                              </Typography>
                            </Box>
                            <StatusChip status={incomingSelected.status} />
                          </Stack>

                          <Divider sx={{ opacity: 0.12 }} />

                          <Box>
                            <Typography sx={{ opacity: 0.75, fontSize: 13, color: "rgba(255,255,255,0.82)" }}>
                              Odbiorca
                            </Typography>
                            <Typography sx={{ fontWeight: 800, color: "rgba(255,255,255,0.92)" }}>
                              {incomingSelected.recipient_name}
                            </Typography>
                            <Typography sx={{ opacity: 0.88, color: "rgba(255,255,255,0.88)" }}>
                              {incomingSelected.recipient_upn}
                            </Typography>
                          </Box>

                          {incomingCanChangeRecipient && (
                            <Box
                              sx={{
                                borderRadius: 3,
                                border: "1px solid rgba(255,255,255,0.10)",
                                background: "rgba(255,255,255,0.04)",
                                p: 1.6,
                              }}
                            >
                              <Stack spacing={1.2}>
                                <Typography sx={{ fontWeight: 900, color: "rgba(255,255,255,0.92)" }}>
                                  Zmień odbiorcę (tylko „Na recepcji”)
                                </Typography>

                                <Autocomplete
                                  options={editUsers}
                                  value={editSelectedUser}
                                  onChange={(_, v) => setEditSelectedUser(v)}
                                  getOptionLabel={(u) => incomingUserLabel(u)}
                                  isOptionEqualToValue={(option, value) =>
                                    (option.mail || option.userPrincipalName || option.id || "") ===
                                    (value.mail || value.userPrincipalName || value.id || "")
                                  }
                                  filterOptions={(x) => x}
                                  loading={editUsersLoading}
                                  onInputChange={(_, v) => setEditUserQuery(v)}
                                  renderInput={(params) => (
                                    <TextField
                                      {...params}
                                      label="Wybierz nowego odbiorcę (UPN/email) — Entra"
                                      InputLabelProps={{ sx: { color: "rgba(255,255,255,0.75)" } }}
                                      sx={{
                                        "& .MuiInputBase-input": { color: "rgba(255,255,255,0.92)" },
                                        "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.18)" },
                                      }}
                                      InputProps={{
                                        ...params.InputProps,
                                        endAdornment: (
                                          <>
                                            {editUsersLoading ? <CircularProgress size={18} /> : null}
                                            {params.InputProps.endAdornment}
                                          </>
                                        ),
                                      }}
                                    />
                                  )}
                                />

                                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                                  <TextField
                                    label="Nowy odbiorca UPN/email"
                                    value={editRecipientUpn}
                                    onChange={(e) => setEditRecipientUpn(e.target.value)}
                                    fullWidth
                                    InputLabelProps={{ sx: { color: "rgba(255,255,255,0.75)" } }}
                                    sx={{
                                      "& .MuiInputBase-input": { color: "rgba(255,255,255,0.92)" },
                                      "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.18)" },
                                    }}
                                  />

                                  <TextField
                                    label="Nowy odbiorca imię i nazwisko"
                                    value={editRecipientName}
                                    onChange={(e) => setEditRecipientName(e.target.value)}
                                    fullWidth
                                    InputLabelProps={{ sx: { color: "rgba(255,255,255,0.75)" } }}
                                    sx={{
                                      "& .MuiInputBase-input": { color: "rgba(255,255,255,0.92)" },
                                      "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.18)" },
                                    }}
                                  />
                                </Stack>

                                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
                                  <Button
                                    variant="contained"
                                    onClick={changeRecipient}
                                    disabled={!canSaveRecipientChange || changeRecipientLoading}
                                    sx={{ minWidth: 220 }}
                                  >
                                    {changeRecipientLoading ? <CircularProgress size={20} /> : "Zapisz zmianę odbiorcy"}
                                  </Button>

                                  {!recipientDirty ? (
                                    <Typography sx={{ opacity: 0.78, color: "rgba(255,255,255,0.86)" }}>
                                      Wybierz innego użytkownika, aby zapisać zmianę.
                                    </Typography>
                                  ) : !canSaveRecipientChange ? (
                                    <Typography sx={{ opacity: 0.78, color: "rgba(255,255,255,0.86)" }}>
                                      Wymagane: UPN/email i imię/nazwisko.
                                    </Typography>
                                  ) : null}
                                </Stack>
                              </Stack>
                            </Box>
                          )}

                          <Box>
                            <Typography sx={{ opacity: 0.75, fontSize: 13, color: "rgba(255,255,255,0.82)" }}>
                              Nadawca
                            </Typography>
                            <Typography sx={{ color: "rgba(255,255,255,0.90)" }}>{incomingSelected.sender_name}</Typography>
                          </Box>

                          <Box>
                            <Typography sx={{ opacity: 0.75, fontSize: 13, color: "rgba(255,255,255,0.82)" }}>
                              Tracking
                            </Typography>
                            <Typography sx={{ color: "rgba(255,255,255,0.90)" }}>
                              {incomingSelected.carrier_name ? `${incomingSelected.carrier_name} • ` : ""}
                              {incomingSelected.carrier_tracking_no}
                            </Typography>
                          </Box>

                          {incomingSelected.contents && (
                            <Box>
                              <Typography sx={{ opacity: 0.75, fontSize: 13, color: "rgba(255,255,255,0.82)" }}>
                                Zawartość
                              </Typography>
                              <Typography sx={{ whiteSpace: "pre-wrap", color: "rgba(255,255,255,0.90)" }}>
                                {incomingSelected.contents}
                              </Typography>
                            </Box>
                          )}

                          <Divider sx={{ opacity: 0.12 }} />

                          <Stack spacing={1.2}>
                            <Typography sx={{ fontWeight: 800, color: "rgba(255,255,255,0.92)" }}>Akcje recepcji</Typography>

                            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
                              <Button
                                variant="contained"
                                onClick={markPickedUp}
                                disabled={!incomingCanPickUp || incomingPickedUpLoading}
                                sx={{ minWidth: 220 }}
                              >
                                {incomingPickedUpLoading ? <CircularProgress size={20} /> : "Odebrana (picked up)"}
                              </Button>

                              {!incomingCanPickUp && incomingSelected.status === "PICKED_UP" && (
                                <Typography sx={{ opacity: 0.78, color: "rgba(255,255,255,0.86)" }}>
                                  Już oznaczona jako <b>odebrana</b>.
                                </Typography>
                              )}
                            </Stack>

                            <Divider sx={{ opacity: 0.12 }} />

                            <Box>
                              <Typography sx={{ opacity: 0.78, fontSize: 13, color: "rgba(255,255,255,0.82)" }}>
                                Czasy
                              </Typography>
                              <Typography sx={{ opacity: 0.92, fontSize: 13, color: "rgba(255,255,255,0.90)" }}>
                                Utworzono: <b>{fmt(incomingSelected.created_at)}</b>
                              </Typography>
                              <Typography sx={{ opacity: 0.92, fontSize: 13, color: "rgba(255,255,255,0.90)" }}>
                                Przyjęto: <b>{fmt(incomingSelected.received_at)}</b>
                              </Typography>
                              <Typography sx={{ opacity: 0.92, fontSize: 13, color: "rgba(255,255,255,0.90)" }}>
                                Odebrano: <b>{fmt(incomingSelected.picked_up_at)}</b>
                              </Typography>
                            </Box>
                          </Stack>
                        </Stack>
                      </Box>
                    )}
                  </Box>
                </Stack>
              )}
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <CreateShipmentDialog
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        onCreated={onCreated}
      />

      <Dialog open={openSuccess} onClose={() => setOpenSuccess(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 900 }}>Zlecenie zapisane ✅</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity="success">Zlecenie zostało zapisane w systemie.</Alert>

            <Card elevation={0} sx={{ border: "1px solid rgba(0,0,0,0.10)", borderRadius: 2 }}>
              <CardContent>
                <Typography sx={{ opacity: 0.75, fontSize: 13 }}>Numer wewnętrzny</Typography>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>
                  {successInternalNo}
                </Typography>
              </CardContent>
            </Card>

            <Typography sx={{ opacity: 0.85 }}>
              Prośba: <b>zapisz/przepisz numer wewnętrzny w widocznym miejscu na paczce</b>
              {" "} (np. markerem na górze lub na karteczce). Dzięki temu recepcja szybko odnajdzie zlecenie w systemie.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setOpenSuccess(false)}>
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </AppShell>
  );
}

function CreateShipmentDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (internalNo: string) => void;
}) {
  const { instance, accounts } = useMsal();

  const [costCenters, setCostCenters] = useState<CostCenterOut[]>([]);
  const [ccLoading, setCcLoading] = useState(false);

  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");

  const [recipientStreet, setRecipientStreet] = useState("");
  const [recipientCity, setRecipientCity] = useState("");
  const [recipientPostal, setRecipientPostal] = useState("");
  const [recipientCountry, setRecipientCountry] = useState("PL");

  const [contents, setContents] = useState("");

  const [vin, setVin] = useState("");
  const [plateNo, setPlateNo] = useState("");

  const [costCenterId, setCostCenterId] = useState("");

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const resetForm = () => {
    setRecipientName("");
    setRecipientEmail("");
    setRecipientPhone("");
    setRecipientStreet("");
    setRecipientCity("");
    setRecipientPostal("");
    setRecipientCountry("PL");
    setContents("");
    setVin("");
    setPlateNo("");
    setCostCenterId("");
    setErr(null);
  };

  useEffect(() => {
    if (!open) return;

    resetForm();

    (async () => {
      setCcLoading(true);
      setErr(null);
      try {
        const data = await apiGetJson<CostCenterOut[]>(instance, accounts, "/cost-centers");
        setCostCenters(data);
      } catch (e: any) {
        setErr(e?.message ?? "Nie udało się pobrać centrów kosztowych.");
      } finally {
        setCcLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const emailOk = recipientEmail.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail);
  const postalOk = isPostalCodeValid(recipientCountry, recipientPostal);
  const vinOk = vin.length === 0 || vin.trim().length === 17;

  const canSubmit =
    recipientName.trim().length >= 2 &&
    recipientEmail.trim().length >= 5 &&
    emailOk &&
    recipientPhone.trim().length >= 3 &&
    recipientStreet.trim().length >= 3 &&
    recipientCity.trim().length >= 2 &&
    recipientPostal.trim().length >= 5 &&
    postalOk &&
    recipientCountry.trim().length === 2 &&
    contents.trim().length >= 3 &&
    !!costCenterId &&
    vinOk;

  const submit = async () => {
    setSaving(true);
    setErr(null);
    try {
      const payload = {
        recipient_name: recipientName.trim(),
        recipient_email: recipientEmail.trim(),
        recipient_phone: recipientPhone.trim(),
        recipient_postal_code: recipientPostal.trim(),
        recipient_city: recipientCity.trim(),
        recipient_country: recipientCountry.trim().toUpperCase(),
        recipient_street: recipientStreet.trim(),
        contents: contents.trim(),
        vin: vin.trim() || null,
        plate_no: plateNo.trim() || null,
        cost_center_id: costCenterId,
      };

      const res = await apiPostJson<any, typeof payload>(instance, accounts, "/shipments", payload);
      onCreated(res.internal_no);
    } catch (e: any) {
      setErr(e?.message ?? "Nie udało się zapisać zlecenia.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 900 }}>Nowe zlecenie nadania</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {err && <Alert severity="error">{err}</Alert>}
          {ccLoading && <Alert severity="info">Ładowanie centrów kosztowych…</Alert>}

          <TextField
            label="Adresat – nazwisko / nazwa"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            required
          />
          <TextField
            label="Adresat – adres mailowy"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            required
            error={!emailOk}
            helperText={!emailOk ? "Nieprawidłowy adres e-mail" : " "}
          />
          <TextField
            label="Adresat – numer kontaktowy"
            value={recipientPhone}
            onChange={(e) => setRecipientPhone(e.target.value)}
            required
          />

          <TextField
            label="Ulica i numer"
            value={recipientStreet}
            onChange={(e) => setRecipientStreet(e.target.value)}
            required
          />

          <PostalCityFields
            country={recipientCountry}
            onCountryChange={(value) => {
              setRecipientCountry(value);
              setRecipientPostal("");
              setRecipientCity("");
            }}
            postalCode={recipientPostal}
            onPostalCodeChange={setRecipientPostal}
            city={recipientCity}
            onCityChange={setRecipientCity}
            postalCodeValid={postalOk}
          />

          <TextField
            label="Zawartość przesyłki"
            value={contents}
            onChange={(e) => setContents(e.target.value)}
            required
            multiline
            minRows={3}
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Numer VIN (opcjonalnie)"
              value={vin}
              onChange={(e) => setVin(e.target.value)}
              error={!vinOk}
              helperText={!vinOk ? "VIN powinien mieć 17 znaków" : " "}
              fullWidth
            />
            <TextField
              label="Numer rejestracyjny (opcjonalnie)"
              value={plateNo}
              onChange={(e) => setPlateNo(e.target.value)}
              fullWidth
            />
          </Stack>

          <FormControl fullWidth>
            <InputLabel id="cc-label">Centrum kosztowe</InputLabel>
            <Select
              labelId="cc-label"
              label="Centrum kosztowe"
              value={costCenterId}
              onChange={(e) => setCostCenterId(String(e.target.value))}
            >
              {costCenters.map((cc) => (
                <MenuItem key={cc.id} value={cc.id}>
                  {cc.code} — {cc.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            resetForm();
            onClose();
          }}
          variant="outlined"
        >
          Anuluj
        </Button>
        <Button onClick={submit} variant="contained" disabled={!canSubmit || saving}>
          {saving ? <CircularProgress size={22} /> : "Zleć nadanie"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}