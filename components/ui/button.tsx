import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "outline" | "fill" | "quiet";

const cls: Record<Variant, string> = {
  outline: "border-[1.2px] border-text text-text",
  fill: "border-[1.2px] border-text bg-text text-paper",
  quiet: "border border-line text-muted",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-full px-[18px] py-[9px] font-mono text-[12px] uppercase tracking-[0.04em] leading-none transition-opacity active:opacity-70";

export function Button({
  variant = "outline",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`${base} ${cls[variant]} ${className}`} {...rest} />;
}

export function ButtonLink({
  href,
  variant = "outline",
  className = "",
  children,
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={`${base} ${cls[variant]} ${className}`}>
      {children}
    </Link>
  );
}
