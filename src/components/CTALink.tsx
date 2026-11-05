"use client";

import Link from "next/link";
import { trackFunnelEvent } from "./FunnelTracker";

interface Props {
  href: string;
  className?: string;
  children: React.ReactNode;
  eventLabel?: string;
}

export function CTALink({ href, className, children, eventLabel = "cta_click" }: Props) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => trackFunnelEvent(eventLabel, "/", { destination: href })}
    >
      {children}
    </Link>
  );
}
