/**
 * Brand mark assets. Swap files under `/public/logo/` (and `assets/logo/` source)
 * without changing call sites - keep these path constants as the single map.
 */
export const LOGO_ASSETS = {
  light: "/logo/lightmode-logo.svg",
  dark: "/logo/darkmode-logo.svg",
} as const;

type LogoSize = "sm" | "md" | "lg";

type LogoProps = {
  className?: string;
  size?: LogoSize;
  /** Show wordmark text beside the mark. */
  withTitle?: boolean;
};

const sizeClasses: Record<LogoSize, string> = {
  sm: "h-6",
  md: "h-8",
  lg: "h-16",
};

/**
 * Theme-aware Tailrace mark. Renders light + dark assets and toggles via CSS.
 *
 * @example
 * ```tsx
 * <Logo size="lg" />
 * <Logo withTitle size="sm" />
 * ```
 */
export function Logo({ className, size = "md", withTitle = false }: LogoProps) {
  const height = sizeClasses[size];

  const mark = (
    <span className={withTitle ? undefined : className}>
      <img
        src={LOGO_ASSETS.light}
        alt={withTitle ? "" : "Tailrace"}
        className={`${height} w-auto dark:hidden`}
      />
      <img
        src={LOGO_ASSETS.dark}
        alt={withTitle ? "" : "Tailrace"}
        className={`hidden ${height} w-auto dark:block`}
      />
    </span>
  );

  if (!withTitle) return mark;

  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`} aria-label="Tailrace">
      {mark}
      <span className="font-semibold">Tailrace</span>
    </span>
  );
}

/** Nav helper: mark + "Tailrace" label. */
export function LogoWithTitle({ className, size = "md" }: Omit<LogoProps, "withTitle">) {
  return <Logo {...(className !== undefined ? { className } : {})} size={size} withTitle />;
}
