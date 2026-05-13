"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";
import { track } from "@vercel/analytics";

type TrackedLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  eventName: string;
  eventData?: Record<string, string | number | boolean | null>;
};

export function TrackedLink({
  children,
  eventName,
  eventData,
  onClick,
  ...props
}: TrackedLinkProps) {
  return (
    <a
      {...props}
      onClick={(event) => {
        track(eventName, eventData);
        onClick?.(event);
      }}
    >
      {children}
    </a>
  );
}
