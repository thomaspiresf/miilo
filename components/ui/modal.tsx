"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Modal = Dialog.Root;
export const ModalTrigger = Dialog.Trigger;
export const ModalClose = Dialog.Close;

export function ModalContent({
  children,
  className,
  title,
  description,
}: {
  children: React.ReactNode;
  className?: string;
  title: string;
  description?: string;
}) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
      <Dialog.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] w-[94vw] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-background shadow-2xl outline-none",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <Dialog.Title className="text-base font-bold">{title}</Dialog.Title>
            {description && (
              <Dialog.Description className="mt-0.5 text-xs text-muted">
                {description}
              </Dialog.Description>
            )}
          </div>
          <Dialog.Close
            className="-mr-1 shrink-0 rounded-full p-1.5 text-muted hover:bg-black/5 hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </Dialog.Close>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  );
}
