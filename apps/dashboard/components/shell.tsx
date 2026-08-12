"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const LINKS = [
  { href: "/policy", label: "Policy" },
  { href: "/audit", label: "Audit" },
  { href: "/settings", label: "Settings" },
];

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link href="/" className="brand" aria-label="Tailrace Plane">
          <img src="/logo/darkmode-logo.svg" alt="" className="brand-mark" />
          <span className="brand-word">Tailrace</span>
          <span className="brand-product">
            <span>Plane</span>
          </span>
        </Link>
        <nav className="nav" aria-label="Primary">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
      {children}
    </div>
  );
}
