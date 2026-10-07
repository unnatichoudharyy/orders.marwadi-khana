import { STORE } from "@/data/config";

const AREAS = STORE.deliveryAreas.map((a) => a.toLowerCase());
const ADMIN_PARTS = ["state", "state_district", "county", "city", "town", "city_district", "municipality"];

/**
 * Is this place inside the delivery area? Uses the administrative parts of an
 * OpenStreetMap address (state / district / city), not street names, so a
 * "Delhi Road" in another city doesn't count. Without a structured address
 * (typed by hand), looks for an area name in the text.
 */
export function inServiceArea(addr: Record<string, string> | null, text = ""): boolean {
  if (addr) {
    const parts = ADMIN_PARTS.map((k) => (addr[k] || "").toLowerCase()).filter(Boolean);
    return parts.some((p) => AREAS.some((a) => p === a || p.includes(a)));
  }
  const t = text.toLowerCase();
  return AREAS.some((a) => new RegExp(`\\b${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(t));
}

/** Rough Delhi NCR box, used only when the address lookup itself fails. */
export function inServiceBox(lat: number, lng: number): boolean {
  const b = STORE.serviceBox;
  return lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east;
}
