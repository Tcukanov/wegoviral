"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

export default function Navbar() {
  const path = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-[rgba(255,255,255,0.07)] bg-ink/90 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5">

        {/* Logo */}
        <Link href="/" className="group flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple/20 ring-1 ring-purple/30 transition-all group-hover:bg-purple/30 group-hover:ring-purple/50">
            <span className="text-sm">⚡</span>
          </div>
          <span className="font-semibold tracking-tight text-t1">
            wegoviral<span className="text-purple">.ai</span>
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          <Link href="/" className={clsx("rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            path === "/" ? "text-t1 bg-ink-4" : "text-t2 hover:text-t1")}>
            Analyze
          </Link>
          <Link href="/dashboard" className={clsx("rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            path === "/dashboard" ? "text-t1 bg-ink-4" : "text-t2 hover:text-t1")}>
            Dashboard
          </Link>
        </div>

        {/* CTA */}
        <Link
          href="/dashboard"
          className={clsx(
            "rounded-xl px-4 py-2 text-sm font-semibold transition-all",
            path === "/dashboard"
              ? "bg-purple text-white shadow-purple-sm"
              : "bg-purple/10 text-purple ring-1 ring-purple/30 hover:bg-purple hover:text-white hover:shadow-purple-sm"
          )}
        >
          Connect Instagram
        </Link>
      </nav>
    </header>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={clsx(
        "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "text-t1 bg-ink-4" : "text-t2 hover:text-t1"
      )}
    >
      {children}
    </Link>
  );
}
