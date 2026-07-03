const COUNTRY_CODES = [
  "AD", "AE", "AF", "AG", "AI", "AL", "AM", "AO", "AQ", "AR", "AS", "AT", "AU", "AW", "AX", "AZ", "BA", "BB", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BL", "BM", "BN", "BO", "BQ", "BR", "BS", "BT", "BV", "BW", "BY", "BZ", "CA", "CC", "CD", "CF", "CG", "CH", "CI", "CK", "CL", "CM", "CN", "CO", "CR", "CU", "CV", "CW", "CX", "CY", "CZ", "DE", "DJ", "DK", "DM", "DO", "DZ", "EC", "EE", "EG", "EH", "ER", "ES", "ET", "FI", "FJ", "FK", "FM", "FO", "FR", "GA", "GB", "GD", "GE", "GF", "GG", "GH", "GI", "GL", "GM", "GN", "GP", "GQ", "GR", "GS", "GT", "GU", "GW", "GY", "HK", "HM", "HN", "HR", "HT", "HU", "ID", "IE", "IL", "IM", "IN", "IO", "IQ", "IR", "IS", "IT", "JE", "JM", "JO", "JP", "KE", "KG", "KH", "KI", "KM", "KN", "KP", "KR", "KW", "KY", "KZ", "LA", "LB", "LC", "LI", "LK", "LR", "LS", "LT", "LU", "LV", "LY", "MA", "MC", "MD", "ME", "MF", "MG", "MH", "MK", "ML", "MM", "MN", "MO", "MP", "MQ", "MR", "MS", "MT", "MU", "MV", "MW", "MX", "MY", "MZ", "NA", "NC", "NE", "NF", "NG", "NI", "NL", "NO", "NP", "NR", "NU", "NZ", "OM", "PA", "PE", "PF", "PG", "PH", "PK", "PL", "PM", "PN", "PR", "PS", "PT", "PW", "PY", "QA", "RE", "RO", "RS", "RU", "RW", "SA", "SB", "SC", "SD", "SE", "SG", "SH", "SI", "SJ", "SK", "SL", "SM", "SN", "SO", "SR", "SS", "ST", "SV", "SX", "SY", "SZ", "TC", "TD", "TF", "TG", "TH", "TJ", "TK", "TL", "TM", "TN", "TO", "TR", "TT", "TV", "TW", "TZ", "UA", "UG", "UM", "US", "UY", "UZ", "VA", "VC", "VE", "VG", "VI", "VN", "VU", "WF", "WS", "YE", "YT", "ZA", "ZM", "ZW",
];

const POSTAL_PATTERNS: Record<string, { pattern: RegExp; hint: string }> = {
  PL: { pattern: /^\d{2}-\d{3}$/, hint: "Format dla Polski: 00-000" },
  US: { pattern: /^\d{5}(-\d{4})?$/, hint: "Format dla USA: 12345 lub 12345-6789" },
  CA: { pattern: /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d$/i, hint: "Format dla Kanady: A1A 1A1" },
  GB: { pattern: /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i, hint: "Format dla Wielkiej Brytanii: SW1A 1AA" },
  DE: { pattern: /^\d{5}$/, hint: "Format dla Niemiec: 12345" },
  FR: { pattern: /^\d{5}$/, hint: "Format dla Francji: 12345" },
  IT: { pattern: /^\d{5}$/, hint: "Format dla Włoch: 12345" },
  ES: { pattern: /^\d{5}$/, hint: "Format dla Hiszpanii: 12345" },
  NL: { pattern: /^\d{4}\s?[A-Z]{2}$/i, hint: "Format dla Holandii: 1234 AB" },
  BE: { pattern: /^\d{4}$/, hint: "Format dla Belgii: 1234" },
  AT: { pattern: /^\d{4}$/, hint: "Format dla Austrii: 1234" },
  CH: { pattern: /^\d{4}$/, hint: "Format dla Szwajcarii: 1234" },
  CZ: { pattern: /^\d{3}\s?\d{2}$/, hint: "Format dla Czech: 123 45" },
  SK: { pattern: /^\d{3}\s?\d{2}$/, hint: "Format dla Słowacji: 123 45" },
};

const DEFAULT_POSTAL_PATTERN = {
  pattern: /^[A-Z0-9][A-Z0-9\s-]{1,11}[A-Z0-9]$/i,
  hint: "Wpisz kod pocztowy w formacie używanym w wybranym kraju.",
};

export type CountryOption = { code: string; label: string };

function countryLabel(code: string) {
  try {
    const displayNames = new Intl.DisplayNames([navigator.language || "pl"], { type: "region" });
    return displayNames.of(code) ?? code;
  } catch {
    return code;
  }
}

export const countryOptions: CountryOption[] = COUNTRY_CODES.map((code) => ({
  code,
  label: `${countryLabel(code)} (${code})`,
})).sort((a, b) => a.label.localeCompare(b.label));

export function isPostalCodeValid(countryCode: string, postalCode: string) {
  const trimmed = postalCode.trim();
  if (!trimmed) return true;
  const rule = POSTAL_PATTERNS[countryCode.toUpperCase()] ?? DEFAULT_POSTAL_PATTERN;
  return rule.pattern.test(trimmed);
}

export function postalCodeHint(countryCode: string) {
  return (POSTAL_PATTERNS[countryCode.toUpperCase()] ?? DEFAULT_POSTAL_PATTERN).hint;
}
