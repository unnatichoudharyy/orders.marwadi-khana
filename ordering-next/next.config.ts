import type { NextConfig } from "next";

// Static export: the site is plain HTML/CSS/JS in `out/`, so it can be hosted
// anywhere (GitHub Pages, Netlify, a shared host…). There's no server, so
// Cache Components / Partial Prefetching (which need Node.js) are off.
//
// NEXT_PUBLIC_BASE_PATH is the sub-path the site is served from:
//   ""          on its own domain, e.g. https://orders.marwadikhana.com
//   "/Ordering" on https://<owner>.github.io/Ordering
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
  cacheComponents: false,
  partialPrefetching: false
};

export default nextConfig;
