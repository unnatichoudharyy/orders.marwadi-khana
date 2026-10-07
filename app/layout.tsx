import type { Metadata, Viewport } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import AddressDialog from "@/components/AddressDialog";
import { Drawer, Toast, TopBar } from "@/components/Chrome";
import { ShopProvider } from "@/components/ShopProvider";

export const metadata: Metadata = {
  title: "Marwadi Khana · Pre-order Mithai Online",
  description: "Pre-order fresh Marwadi mithai, halwa, laddus, burfi and Navratri thalis for home delivery across Delhi NCR and Gurgaon.",
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🪔</text></svg>" }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#7b1626"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- same fonts as the old site, loaded at runtime */}
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&family=Yatra+One&display=swap" rel="stylesheet" />
      </head>
      <body>
        <ShopProvider>
          <TopBar />
          <main id="view" tabIndex={-1}>{children}</main>
          <Drawer />
          <AddressDialog />
          <Toast />
        </ShopProvider>
      </body>
    </html>
  );
}
