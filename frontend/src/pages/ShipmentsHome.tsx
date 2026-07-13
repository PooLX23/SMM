import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Typography,
  Chip,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  Tab,
  Tabs,
} from "@mui/material";
import AppShell from "../components/AppShell";
import PostalCityFields from "../components/PostalCityFields";
import { isPostalCodeValid } from "../utils/postalAddress";
import { useMsal } from "@azure/msal-react";
import { apiGetJson, apiPostJson } from "../api/apiClient";

type ShipmentOut = {
  id: string;
  internal_no: string;
  direction?: string;
  status: string;
  created_at: string;

  recipient_name: string;
  recipient_email: string;
  recipient_phone: string;
  recipient_city: string;
  recipient_postal_code: string;
  recipient_country?: string;
  recipient_street: string;

  contents: string;
  vin?: string | null;
  plate_no?: string | null;

  cost_center_id?: string | null;
  cost_center_code?: string | null;
  cost_center_name?: string | null;

  requested_by_upn?: string | null;
  requested_by_name?: string | null;

  carrier_id?: string | null;
  carrier_tracking_no?: string | null;

  received_at?: string | null;
  shipped_at?: string | null;

  updated_at?: string | null;
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

type CostCenterOut = { id: string; code: string; name: string; active: boolean };

type AddressBookEntry = {
  id: string;
  recipient_name: string;
  recipient_email: string;
  recipient_phone: string;
  recipient_street: string;
  recipient_country: string;
  recipient_postal_code: string;
  recipient_city: string;
  created_at?: string;
  updated_at?: string;
};

function statusLabel(status: string) {
  switch (status) {
    case "CREATED":
      return "Utworzona";
    case "AT_RECEPTION":
      return "Na recepcji";
    case "SHIPPED":
      return "Nadana";
    case "CANCELLED":
      return "Anulowana";
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

export default function ShipmentsHome() {
  const { instance, accounts } = useMsal();

  // ==========================
  // TABS
  // ==========================
  const [tab, setTab] = useState<0 | 1>(0);

  // ==========================
  // OUTGOING (TAB 0)
  // ==========================
  const [items, setItems] = useState<ShipmentOut[]>([]);
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // auto refresh (shared)
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<number | null>(null);

  // selected (detail)
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => items.find((x) => x.id === selectedId) ?? null,
    [items, selectedId]
  );

  // create dialog state
  const [openCreate, setOpenCreate] = useState(false);

  // success dialog state
  const [openSuccess, setOpenSuccess] = useState(false);
  const [successInternalNo, setSuccessInternalNo] = useState<string>("");

  const loadOutgoing = async (silent?: boolean) => {
    if (!silent) {
      setLoading(true);
      setError(null);
      setInfo(null);
    }

    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (status) params.set("status", status);
      params.set("limit", "200");

      const data = await apiGetJson<ShipmentOut[]>(
        instance,
        accounts,
        `/my-shipments?${params.toString()}`
      );

      setItems(data);

      if (!selectedId && data.length > 0) setSelectedId(data[0].id);
      if (selectedId && !data.some((x) => x.id === selectedId)) {
        setSelectedId(data.length > 0 ? data[0].id : null);
      }
    } catch (e: any) {
      if (!silent) setError(e?.message ?? "Nie udało się pobrać listy przesyłek.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // initial + when status changes (manual) – only outgoing
  useEffect(() => {
    if (tab !== 0) return;
    loadOutgoing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, tab]);

  const filteredHint = useMemo(() => {
    if (!q.trim() && !status) return null;
    return "Filtry zastosowane";
  }, [q, status]);

  const onCreated = (internalNo: string) => {
    setSuccessInternalNo(internalNo);
    setOpenSuccess(true);
    setOpenCreate(false);
    loadOutgoing(); // po utworzeniu zlecenia odśwież normalnie
  };

  const costCenterLabel = (s: ShipmentOut) => {
    const code = s.cost_center_code?.trim();
    const name = s.cost_center_name?.trim();
    if (code && name) return `${code} — ${name}`;
    if (code) return code;
    if (name) return name;
    return s.cost_center_id || "—";
  };

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

  const loadIncoming = async (silent?: boolean) => {
    if (!silent) {
      setIncomingLoading(true);
      setError(null);
      setInfo(null);
    }

    try {
      const params = new URLSearchParams();
      params.set("limit", "200");
      if (incomingStatus) params.set("status", incomingStatus);
      if (incomingQ.trim()) params.set("q", incomingQ.trim());

      const data = await apiGetJson<IncomingShipmentOut[]>(
        instance,
        accounts,
        `/my-incoming-shipments?${params.toString()}`
      );

      setIncomingItems(data);

      if (!incomingSelectedId && data.length > 0) setIncomingSelectedId(data[0].id);
      if (incomingSelectedId && !data.some((x) => x.id === incomingSelectedId)) {
        setIncomingSelectedId(data.length > 0 ? data[0].id : null);
      }
    } catch (e: any) {
      if (!silent) setError(e?.message ?? "Nie udało się pobrać listy przesyłek przychodzących.");
    } finally {
      if (!silent) setIncomingLoading(false);
    }
  };

  // initial load incoming when switching to tab 1 first time
  useEffect(() => {
    if (tab === 1 && incomingItems.length === 0) {
      loadIncoming();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // ✅ AUTO REFRESH FOR BOTH TABS
  useEffect(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (autoRefresh) {
      intervalRef.current = window.setInterval(() => {
        // TAB 0: pause during dialogs
        if (tab === 0) {
          if (openCreate || openSuccess) return;
          loadOutgoing(true);
          return;
        }

        // TAB 1: incoming silent refresh
        if (tab === 1) {
          loadIncoming(true);
          return;
        }
      }, 10_000);
    }

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    autoRefresh,
    tab,

    // outgoing deps
    q,
    status,
    selectedId,
    openCreate,
    openSuccess,

    // incoming deps
    incomingQ,
    incomingStatus,
    incomingSelectedId,
  ]);

  return (
    <AppShell title="Courier Registry • Panel użytkownika">
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
            {/* HEADER (one line, button on right) */}
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1.2}
              alignItems={{ xs: "flex-start", md: "center" }}
              justifyContent="space-between"
            >
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 900, color: "rgba(255,255,255,0.92)" }}>
                  Panel użytkownika
                </Typography>
                <Typography sx={{ opacity: 0.78, color: "rgba(255,255,255,0.85)" }}>
                  Twoje nadania oraz paczki przychodzące przypisane do Ciebie.
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
              <Tab label="Outgoing (Moje nadania)" value={0} />
              <Tab label="Incoming (Do odbioru)" value={1} />
            </Tabs>

            <Box sx={{ flex: "0 0 auto" }}>
              {info && <Alert severity="success">{info}</Alert>}
              {error && <Alert severity="error">{error}</Alert>}
            </Box>

            {/* shared auto refresh switch (both tabs) */}
            <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" sx={{ mt: -0.5 }}>
              <FormControlLabel
                control={<Switch checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />}
                label={
                  <Typography sx={{ opacity: 0.85, color: "rgba(255,255,255,0.88)" }}>
                    Auto-odświeżanie co 10s
                  </Typography>
                }
              />
              <Typography sx={{ opacity: 0.65, fontSize: 12, color: "rgba(255,255,255,0.82)" }}>
                {autoRefresh
                  ? tab === 0
                    ? openCreate || openSuccess
                      ? "Wstrzymane (dialog)"
                      : "Włączone"
                    : "Włączone"
                  : "Wyłączone"}
              </Typography>
            </Stack>

            <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
              {/* ========================= TAB 0: OUTGOING ========================= */}
              {tab === 0 && (
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={2}
                  alignItems="stretch"
                  sx={{ height: "100%", minHeight: 0 }}
                >
                  {/* LEFT (MASTER) */}
                  <Box sx={{ flex: 1.1, minWidth: 360, display: "flex", flexDirection: "column", minHeight: 0 }}>
                    <Stack spacing={1.2} sx={{ minHeight: 0, height: "100%" }}>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} alignItems="stretch">
                        <TextField
                          label="Szukaj (numer, adresat, email, telefon, adres)"
                          value={q}
                          onChange={(e) => setQ(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") loadOutgoing();
                          }}
                          fullWidth
                          InputLabelProps={{ sx: { color: "rgba(255,255,255,0.75)" } }}
                          sx={{
                            "& .MuiInputBase-input": { color: "rgba(255,255,255,0.92)" },
                            "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.18)" },
                            "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.28)" },
                          }}
                        />

                        <FormControl sx={{ minWidth: 220 }}>
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
                            <MenuItem value="CANCELLED">Anulowana</MenuItem>
                          </Select>
                        </FormControl>

                        <Button variant="outlined" onClick={() => loadOutgoing()} sx={{ minWidth: 120 }}>
                          Filtruj
                        </Button>
                      </Stack>

                      <Box>
                        {filteredHint && (
                          <Typography sx={{ opacity: 0.7, color: "rgba(255,255,255,0.82)" }}>
                            {filteredHint}
                          </Typography>
                        )}
                      </Box>

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
                            Moje nadania ({items.length})
                          </Typography>
                          {loading && <CircularProgress size={20} />}
                        </Box>
                        <Divider sx={{ opacity: 0.12 }} />

                        <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                          {!loading && items.length === 0 ? (
                            <Box sx={{ p: 2 }}>
                              <Alert severity="info">Brak przesyłek dla podanych filtrów.</Alert>
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
                                          sx={{ opacity: 0.66, fontSize: 11, color: "rgba(255,255,255,0.74)" }}
                                          noWrap
                                        >
                                          CC: {costCenterLabel(s)}
                                        </Typography>
                                      </Box>

                                      <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography
                                          sx={{ opacity: 0.88, fontSize: 12, color: "rgba(255,255,255,0.86)" }}
                                          noWrap
                                        >
                                          {s.recipient_email} • {s.recipient_phone}
                                        </Typography>
                                        <Typography
                                          sx={{ opacity: 0.74, fontSize: 12, color: "rgba(255,255,255,0.80)" }}
                                          noWrap
                                        >
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

                  {/* RIGHT (DETAIL) */}
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
                              {selected.recipient_street}, {selected.recipient_postal_code} {selected.recipient_city}
                              {selected.recipient_country ? `, ${selected.recipient_country}` : ""}
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
                          </Box>
                        </Stack>
                      </Box>
                    )}
                  </Box>
                </Stack>
              )}

              {/* ========================= TAB 1: INCOMING ========================= */}
              {tab === 1 && (
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={2}
                  alignItems="stretch"
                  sx={{ height: "100%", minHeight: 0 }}
                >
                  {/* LEFT (LIST) */}
                  <Box sx={{ flex: 1.1, minWidth: 360, display: "flex", flexDirection: "column", minHeight: 0 }}>
                    <Stack spacing={1.2} sx={{ minHeight: 0, height: "100%" }}>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.2} alignItems="stretch">
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

                        <FormControl sx={{ minWidth: 210 }}>
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

                        <Button variant="outlined" onClick={() => loadIncoming()} sx={{ minWidth: 120 }}>
                          Filtruj
                        </Button>
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
                            Przychodzące ({incomingItems.length})
                          </Typography>
                          {incomingLoading && <CircularProgress size={20} />}
                        </Box>
                        <Divider sx={{ opacity: 0.12 }} />

                        <Box sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
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
                                        <Typography
                                          sx={{ opacity: 0.70, fontSize: 11, color: "rgba(255,255,255,0.78)" }}
                                          noWrap
                                        >
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

                  {/* RIGHT (DETAIL) */}
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

                          <Box>
                            <Typography sx={{ opacity: 0.75, fontSize: 13, color: "rgba(255,255,255,0.82)" }}>
                              Nadawca
                            </Typography>
                            <Typography sx={{ color: "rgba(255,255,255,0.90)" }}>
                              {incomingSelected.sender_name}
                            </Typography>
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
                      </Box>
                    )}
                  </Box>
                </Stack>
              )}
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <CreateShipmentDialog open={openCreate} onClose={() => setOpenCreate(false)} onCreated={onCreated} />

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
              Prośba: <b>zapisz/przepisz numer wewnętrzny w widocznym miejscu na paczce</b> (np. markerem na górze lub
              na karteczce). Dzięki temu recepcja szybko odnajdzie zlecenie w systemie.
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
  const [addressBook, setAddressBook] = useState<AddressBookEntry[]>([]);
  const [selectedAddressBookEntry, setSelectedAddressBookEntry] = useState<AddressBookEntry | null>(null);
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
    setSelectedAddressBookEntry(null);

    setErr(null);
  };

  useEffect(() => {
    if (!open) return;

    resetForm();

    (async () => {
      setCcLoading(true);
      setErr(null);
      try {
        const [ccData, addressData] = await Promise.all([
          apiGetJson<CostCenterOut[]>(instance, accounts, "/cost-centers"),
          apiGetJson<AddressBookEntry[]>(instance, accounts, "/address-book?limit=500"),
        ]);
        setCostCenters(ccData);
        setAddressBook(addressData);
      } catch (e: any) {
        setErr(e?.message ?? "Nie udało się pobrać centrów kosztowych.");
      } finally {
        setCcLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);


  const applyAddressBookEntry = (entry: AddressBookEntry | null) => {
    setSelectedAddressBookEntry(entry);
    if (!entry) return;
    setRecipientName(entry.recipient_name);
    setRecipientEmail(entry.recipient_email);
    setRecipientPhone(entry.recipient_phone);
    setRecipientStreet(entry.recipient_street);
    setRecipientCountry(entry.recipient_country || "PL");
    setRecipientPostal(entry.recipient_postal_code);
    setRecipientCity(entry.recipient_city);
  };

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
          {ccLoading && <Alert severity="info">Ładowanie centrów kosztowych i książki adresowej…</Alert>}

          <Autocomplete
            options={addressBook}
            value={selectedAddressBookEntry}
            onChange={(_, value) => applyAddressBookEntry(value)}
            getOptionLabel={(entry) => `${entry.recipient_name} — ${entry.recipient_city}, ${entry.recipient_street}`}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Wybierz adresata z książki adresowej"
                helperText="Po wyborze dane adresata zostaną uzupełnione, ale nadal możesz je ręcznie zmienić."
              />
            )}
          />

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