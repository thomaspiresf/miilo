"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;

export function SheetContent({
  children,
  side = "right",
  className,
  title,
}: {
  children: React.ReactNode;
  side?: "right" | "bottom" | "left";
  className?: string;
  title: string;
}) {
  const sides = {
    right: "inset-y-0 right-0 h-full w-[88vw] max-w-sm",
    left: "inset-y-0 left-0 h-full w-[88vw] max-w-sm",
    bottom: "inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl",
  } as const;
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
      <Dialog.Content
        className={cn(
          "fixed z-50 flex flex-col bg-background shadow-xl outline-none",
          sides[side],
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <Dialog.Title className="text-base font-bold">{title}</Dialog.Title>
          <Dialog.Close
            className="rounded-full p-1.5 hover:bg-black/5"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </Dialog.Close>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  );
}
