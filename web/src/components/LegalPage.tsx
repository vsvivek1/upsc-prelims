import { Logo } from "./Logo";
import { SiteFooter } from "./SiteFooter";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="flex-1">
      <header className="mx-auto max-w-3xl px-4 py-4">
        <Logo />
      </header>
      <article className="mx-auto max-w-3xl px-4 pb-16 [&_h2]:font-display [&_h2]:mt-8 [&_h2]:text-xl [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-3 [&_p]:leading-relaxed [&_ul]:mt-3 [&_ul]:space-y-1">
        <h1 className="font-display text-4xl">{title}</h1>
        <p className="text-sm text-muted">Last updated {updated}</p>
        {children}
      </article>
      <SiteFooter />
    </main>
  );
}
