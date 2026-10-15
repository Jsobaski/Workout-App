// Client-side helpers for the "Estimate with AI" PIN lock. The PIN itself is
// never embedded in the bundle — it's only checked against ESTIMATE_PIN on
// the server (see /api/verify and /api/estimate-food).
const STORAGE_KEY = "app-pin";

export function getSavedPin(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setSavedPin(pin: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, pin);
  } catch {
    // ignore — e.g. storage disabled in a private window
  }
}

export function clearSavedPin(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export async function verifyPin(pin: string): Promise<boolean> {
  try {
    const res = await fetch("/api/verify", { headers: { "x-app-pin": pin } });
    if (!res.ok) return false;
    const data = await res.json();
    return data.ok === true;
  } catch {
    return false;
  }
}
