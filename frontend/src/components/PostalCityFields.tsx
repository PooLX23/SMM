import { useEffect, useMemo, useState } from "react";
import { Autocomplete, CircularProgress, Stack, TextField } from "@mui/material";

import { countryOptions, postalCodeHint } from "../utils/postalAddress";

type Props = {
  country: string;
  onCountryChange: (country: string) => void;
  postalCode: string;
  onPostalCodeChange: (postalCode: string) => void;
  city: string;
  onCityChange: (city: string) => void;
  postalCodeValid: boolean;
};

export default function PostalCityFields({
  country,
  onCountryChange,
  postalCode,
  onPostalCodeChange,
  city,
  onCityChange,
  postalCodeValid,
}: Props) {
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const normalizedCountry = country.trim().toUpperCase();
  const selectedCountry = useMemo(
    () => countryOptions.find((x) => x.code === normalizedCountry) ?? countryOptions.find((x) => x.code === "PL") ?? null,
    [normalizedCountry]
  );

  useEffect(() => {
    setCityOptions([]);
    if (!postalCode.trim() || !postalCodeValid || normalizedCountry.length !== 2) return;

    const ctrl = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoadingCities(true);
      try {
        const resp = await fetch(
          `https://api.zippopotam.us/${normalizedCountry.toLowerCase()}/${encodeURIComponent(postalCode.trim())}`,
          { signal: ctrl.signal }
        );
        if (!resp.ok) {
          setCityOptions([]);
          return;
        }
        const data = await resp.json();
        const cities = Array.from(
          new Set(
            ((data.places ?? []) as Array<Record<string, unknown>>)
              .map((place) => String(place["place name"] ?? "").trim())
              .filter(Boolean)
          )
        ).sort((a, b) => a.localeCompare(b));
        setCityOptions(cities);
        if (cities.length === 1 && !city.trim()) onCityChange(cities[0]);
      } catch (e: unknown) {
        if (!(e instanceof DOMException) || e.name !== "AbortError") setCityOptions([]);
      } finally {
        if (!ctrl.signal.aborted) setLoadingCities(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
      setLoadingCities(false);
    };
  }, [city, normalizedCountry, onCityChange, postalCode, postalCodeValid]);

  const helperText = !postalCodeValid
    ? postalCodeHint(normalizedCountry)
    : cityOptions.length > 1
      ? "Wybierz miasto z podpowiedzi albo wpisz je ręcznie."
      : "Miasto można zawsze wpisać ręcznie.";

  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
      <Autocomplete
        options={countryOptions}
        value={selectedCountry}
        onChange={(_, value) => onCountryChange(value?.code ?? "PL")}
        getOptionLabel={(option) => option.label}
        isOptionEqualToValue={(option, value) => option.code === value.code}
        renderInput={(params) => <TextField {...params} label="Kraj" required />}
        fullWidth
      />
      <TextField
        label="Kod pocztowy"
        value={postalCode}
        onChange={(e) => onPostalCodeChange(e.target.value.toUpperCase())}
        required
        error={!postalCodeValid}
        helperText={!postalCodeValid ? postalCodeHint(normalizedCountry) : " "}
        fullWidth
      />
      <Autocomplete
        freeSolo
        options={cityOptions}
        value={city}
        inputValue={city}
        onInputChange={(_, value) => onCityChange(value)}
        onChange={(_, value) => onCityChange(value ?? "")}
        loading={loadingCities}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Miasto"
            required
            helperText={helperText}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loadingCities ? <CircularProgress color="inherit" size={18} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
        fullWidth
      />
    </Stack>
  );
}
