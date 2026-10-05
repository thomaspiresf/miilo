"use client";

import { useState } from "react";
import { ExternalLink, Paperclip } from "lucide-react";
import { Modal, ModalContent } from "@/components/ui/modal";

/** Botão "Nota": abre a imagem da nota num pop-up, sem sair da página. */
export function ReceiptViewer({ url, title }: { url: string; title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Ver nota"
        aria-label="Ver nota"
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted hover:bg-black/5 hover:text-foreground"
      >
        <Paperclip className="h-3.5 w-3.5" /> Nota
      </button>
      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent title="Nota anexada" description={title} className="max-w-2xl">
          <div className="flex justify-center rounded-xl bg-black/[0.04] p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`Nota de ${title}`} className="max-h-[68vh] w-auto max-w-full rounded-lg object-contain" />
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Abrir em tamanho original
          </a>
        </ModalContent>
      </Modal>
    </>
  );
}
