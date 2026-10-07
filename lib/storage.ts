// Saved in the browser under the same "mk_*" keys as the old site, so
// customers keep their cart, address and details after the switch.

export function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem("mk_" + key);
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem("mk_" + key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode etc.) */
  }
}
