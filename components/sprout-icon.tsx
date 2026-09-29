import type { SVGProps } from "react";

// The app icon's sprout (app/icon.svg) without its square, so in-app sprouts match the icon.
export function SproutIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="11 10 42 44" fill="currentColor" {...props}>
      <path d="M20 51 L44 51" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M31 51 C33 44 31 38 33 29" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M31 38 C22 38 16 32 14 23 C23 22 30 28 31 38 Z" />
      <path d="M33 31 C33 21 39 14 50 13 C51 23 44 30 33 31 Z" />
    </svg>
  );
}
