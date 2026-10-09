import Link from "next/link";
import { Logo } from "../Logo";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-[1.5fr_1fr_1fr] sm:px-6">
        <div>
          <Logo size="sm" tagline />
          <p className="mt-4 max-w-xs text-sm text-muted">Live, one-on-one, ten-minute debates. Anyone can challenge an idea.</p>
        </div>
        <nav aria-label="Product" className="space-y-2 text-sm">
          <Link className="block text-muted hover:text-ink" href="/discover">Discover debates</Link>
          <Link className="block text-muted hover:text-ink" href="/trending">Trending motions</Link>
          <Link className="block text-muted hover:text-ink" href="/communities">Communities</Link>
          <Link className="block text-muted hover:text-ink" href="/how-it-works">How FaceOff works</Link>
        </nav>
        <nav aria-label="Legal and support" className="space-y-2 text-sm">
          <Link className="block text-muted hover:text-ink" href="/guidelines">Community guidelines</Link>
          <Link className="block text-muted hover:text-ink" href="/privacy">Privacy policy</Link>
          <Link className="block text-muted hover:text-ink" href="/terms">Terms of service</Link>
          <Link className="block text-muted hover:text-ink" href="/contact">Contact and support</Link>
        </nav>
      </div>
      <p className="mx-auto max-w-6xl px-4 pb-8 text-xs text-subtle sm:px-6">© {new Date().getFullYear()} FaceOff. Votes measure persuasion and opinion among viewers — never factual truth.</p>
    </footer>
  );
}
