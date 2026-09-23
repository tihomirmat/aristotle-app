// Backend funkcije vračajo { error, code } (npr. 402 TRIAL_CREDITS_EXHAUSTED, MODULE_LOCKED, 403 FORBIDDEN).
// Base44 SDK ob statusu ≥ 400 vrže axios napako — uporabniku je prej prikazano "Request failed with status code 402".
export const fnError = (err) =>
  err?.response?.data?.error || err?.data?.error || err?.response?.data?.message || err?.message || "Neznana napaka";
export const fnCode = (err) => err?.response?.data?.code || err?.data?.code || "";
