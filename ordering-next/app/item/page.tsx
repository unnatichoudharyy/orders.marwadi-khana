"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ItemPage from "@/components/ItemPage";

// Items added only in the Google Sheet have no pre-built page, so they open
// here as /item/?id=… (items in data/menu.ts use /item/<id>/).
function ByQuery() {
  const id = useSearchParams().get("id") || "";
  return <ItemPage id={id} />;
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ByQuery />
    </Suspense>
  );
}
