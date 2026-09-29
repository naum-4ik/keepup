"use client"

import * as React from "react"
import { XIcon } from "lucide-react"
import { Dialog as SheetPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

// Bottom sheet built on Radix Dialog: focus trap, Escape and outside tap close it.
function Sheet(props: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetContent({ className, children, ...props }: React.ComponentProps<typeof SheetPrimitive.Content>) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[90dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-3xl bg-background p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-soft",
          "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=open]:duration-200",
          className,
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="absolute top-3 right-3 flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
          <XIcon className="size-5" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  )
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title className={cn("pr-12 text-lg font-bold", className)} {...props} />
}

function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return <SheetPrimitive.Description className={cn("text-sm text-muted-foreground", className)} {...props} />
}

export { Sheet, SheetContent, SheetTitle, SheetDescription }
