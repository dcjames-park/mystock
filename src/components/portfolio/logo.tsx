import { cn } from "@/lib/utils";

/** Brand mark: three accounts mapping into one portfolio sparkline. */
export function FolioMark({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <circle cx="7.5" cy="8.5" r="2.15" fill="#fff" />
      <circle cx="7.5" cy="16" r="2.15" fill="#5EC8C5" />
      <circle cx="7.5" cy="23.5" r="2.15" fill="#C4B5FD" />
      <path
        d="M10 8.5C14 8.5 15 14 18.5 16"
        stroke="#fff"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <path d="M10 16H18.5" stroke="#fff" strokeWidth="1.35" strokeLinecap="round" />
      <path
        d="M10 23.5C14 23.5 15 18 18.5 16"
        stroke="#fff"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <path
        d="M18.5 16 22 20 26 13 29.5 8.5V28H18.5Z"
        fill="#fff"
        fillOpacity="0.22"
      />
      <path
        d="M18.5 16 22 20 26 13 29.5 8.5"
        stroke="#fff"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FolioLogo({
  markSize = 28,
  className,
  wordmarkClassName,
}: {
  markSize?: number;
  className?: string;
  wordmarkClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-primary", className)}>
      <FolioMark size={markSize} />
      <span
        className={cn(
          "font-heading font-semibold tracking-tight",
          wordmarkClassName,
        )}
      >
        Folio
      </span>
    </span>
  );
}
