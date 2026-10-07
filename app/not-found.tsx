import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page">
      <p className="empty">🪔<br /><br />This page doesn&apos;t exist.</p>
      <Link className="btn primary block" href="/">Back to menu</Link>
    </div>
  );
}
