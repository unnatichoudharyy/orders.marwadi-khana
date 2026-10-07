import { MENU } from "@/data/menu";
import ItemPage from "@/components/ItemPage";

// One page per menu item, built ahead of time (static export).
// Items added only in the Google Sheet (with no entry in data/menu.ts) don't
// get their own page; add them to data/menu.ts as well.
export const dynamicParams = false;

export function generateStaticParams() {
  return MENU.flatMap((c) => c.items.map((i) => ({ id: i.id })));
}

export default async function Page({ params }: PageProps<"/item/[id]">) {
  const { id } = await params;
  return <ItemPage id={id} />;
}
