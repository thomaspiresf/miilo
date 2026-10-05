"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, ModalContent } from "@/components/ui/modal";
import { ExpenseForm } from "@/components/admin/expense-form";

/** Botão "Adicionar investimento" que abre o formulário num pop-up; fecha sozinho ao lançar. */
export function AddExpenseDialog({ today }: { today: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> Adicionar investimento
      </Button>
      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent
          title="Novo investimento"
          description="Anexe a foto da nota e a IA preenche os campos, ou lance na mão."
          className="max-w-xl"
        >
          <ExpenseForm today={today} onSaved={() => setOpen(false)} />
        </ModalContent>
      </Modal>
    </>
  );
}
