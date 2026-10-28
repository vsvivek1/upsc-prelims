import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-card">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 Calecute Technologies LLC · Algo UPSC</p>
        <nav className="flex flex-wrap gap-4">
          <Link href="/help">Help</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/refunds">Refunds</Link>
          <Link href="/delete-account">Delete account</Link>
          <a href="https://calecutech.com">calecutech.com</a>
        </nav>
      </div>
    </footer>
  );
}
