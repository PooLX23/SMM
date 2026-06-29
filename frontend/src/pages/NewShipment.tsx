import { useMemo, useState } from "react";
import { Button, Card, CardContent, Stack, TextField, Typography } from "@mui/material";
import { useMsal } from "@azure/msal-react";
import AppShell from "../components/AppShell";
import { apiPostJson } from "../api/apiClient";

export default function NewShipment() {
  const { instance, accounts } = useMsal();

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

  // MVP: na razie wpis ręczny UUID (krok 3/5 później zrobimy select)
  const [costCenterId, setCostCenterId] = useState("");

  const emailOk = useMemo(
    () => recipientEmail.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail),
    [recipientEmail]
  );
  const postalOk = useMemo(
    () => recipientPostal.length === 0 || /^\d{2}-\d{3}$/.test(recipientPostal),
    [recipientPostal]
  );
  const vinOk = useMemo(
    () => vin.length === 0 || vin.trim().length === 17,
    [vin]
  );

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
    costCenterId.trim().length >= 10 && // UUID ma 36, ale zostawiamy minimalnie
    vinOk;

  const submit = async () => {
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
      cost_center_id: costCenterId.trim(),
    };

    const res = await apiPostJson<any, typeof payload>(instance, accounts, "/shipments", payload);
    alert(`Zlecenie zapisane.\nNumer wewnętrzny: ${res.internal_no ?? res.internalNo ?? res.internal_no ?? res.internal_no}`);
  };

  return (
    <AppShell title="Courier Registry • Nowa przesyłka">
      <Card sx={{ borderRadius: 4 }}>
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={2}>
            <Typography variant="h5" fontWeight={800}>
              Nowa przesyłka
            </Typography>

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

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Kod pocztowy"
                value={recipientPostal}
                onChange={(e) => setRecipientPostal(e.target.value)}
                required
                error={!postalOk}
                helperText={!postalOk ? "Format: 00-000" : " "}
                fullWidth
              />
              <TextField
                label="Miasto"
                value={recipientCity}
                onChange={(e) => setRecipientCity(e.target.value)}
                required
                fullWidth
              />
              <TextField
                label="Kraj"
                value={recipientCountry}
                onChange={(e) => setRecipientCountry(e.target.value)}
                inputProps={{ maxLength: 2 }}
                required
                fullWidth
              />
            </Stack>

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

            <TextField
              label="Centrum kosztowe (UUID) – tymczasowo"
              value={costCenterId}
              onChange={(e) => setCostCenterId(e.target.value)}
              required
              helperText="W następnym kroku zrobimy listę wybieralną z /api/cost-centers"
            />

            <Button variant="contained" onClick={submit} disabled={!canSubmit}>
              Zleć nadanie
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </AppShell>
  );
}
