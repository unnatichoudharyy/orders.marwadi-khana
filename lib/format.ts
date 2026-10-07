import { STORE } from "@/data/config";

export const money = (n: number) => STORE.currency + Math.round(n).toLocaleString("en-IN");
export const plain = (n: number) => Math.round(n).toLocaleString("en-IN");
export const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
export const slug = (s: string) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Site path, honouring the deploy's basePath (e.g. "/Ordering" on GitHub Pages). */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** Photo paths in the menu/Sheet are written like "images/x.webp"; make them work on every page. */
export function asset(src: string): string {
  if (/^(https?:|data:|\/\/)/.test(src)) return src;
  return `${BASE_PATH}/${src.replace(/^\/+/, "")}`;
}
