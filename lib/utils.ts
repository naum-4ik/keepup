import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// The three spacing levels (app/globals.css --spacing-inner/item/section, docs/design.md) are theme
// spacing, so tailwind-merge treats gap-inner, p-item, my-section… like gap-2, p-4, my-6: a later
// one replaces an earlier one (cn("gap-1.5", "gap-inner") → "gap-inner") instead of both staying.
const twMerge = extendTailwindMerge({
  extend: { theme: { spacing: ["inner", "item", "section"] } },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
