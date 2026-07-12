type LogoProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
};

const sizeClasses = {
  sm: "h-6",
  md: "h-8",
  lg: "h-16",
} as const;

export function Logo({ className, size = "md" }: LogoProps) {
  const height = sizeClasses[size];

  return (
    <span className={className}>
      <img
        src="/logo/lightmode-logo.svg"
        alt="Tailrace"
        className={`${height} w-auto dark:hidden`}
      />
      <img
        src="/logo/darkmode-logo.svg"
        alt="Tailrace"
        className={`hidden ${height} w-auto dark:block`}
      />
    </span>
  );
}

export function LogoWithTitle({ className, size = "md" }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <Logo size={size} />
      <span className="font-semibold">Tailrace</span>
    </span>
  );
}
