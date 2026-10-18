import type { HTMLAttributes } from "react";

type Props = HTMLAttributes<HTMLSpanElement> & { size?: number; muted?: string };

/** Weight-200 instrument numeral, e.g. the date or a count. `muted` renders a trailing dim part like "/31". */
export function ThinNumber({ size = 84, muted, className = "", children, style, ...rest }: Props) {
  return (
    <span className={`thin block ${className}`} style={{ fontSize: size, ...style }} {...rest}>
      {children}
      {muted ? <span className="text-muted">{muted}</span> : null}
    </span>
  );
}
