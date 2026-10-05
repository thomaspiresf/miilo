"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Modal, ModalContent } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/misc";
import { updateCustomerAction } from "@/app/admin/pedidos/actions";
import { formatWhatsAppPhone } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Edita nome, telefone e e-mail do cliente. O dado vive em cada pedido, então a
 * mudança vale para todos os pedidos informados (os do cliente, ou só um).
 */
export function EditCustomerDialog({
  orderIds,
  name,
  phones,
  emails,
  label,
  variant = "icon",
}: {
  orderIds: string[];
  name: string | null;
  phones: string[];
  emails: string[];
  label?: string;
  variant?: "icon" | "button";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: name ?? "", phone: phones[0] ?? "", email: emails[0] ?? "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setError(null);
  };

  function openDialog() {
    // reabre sempre com os dados atuais
    setForm({ name: name ?? "", phone: phones[0] ?? "", email: emails[0] ?? "" });
    setError(null);
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await updateCustomerAction(orderIds, form);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  const many = orderIds.length > 1;
  const extraPhones = phones.length > 1;
  const extraEmails = emails.length > 1;

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={openDialog}
          aria-label="Editar dados do cliente"
          title="Editar dados do cliente"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:bg-black/5 hover:text-foreground"
        >
          <Pencil className="h-4 w-4" />
        </button>
      ) : (
        <Button size="sm" variant="outline" onClick={openDialog}>
          <Pencil className="h-3.5 w-3.5" /> {label ?? "Editar cliente"}
        </Button>
      )}

      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent
          title="Editar cliente"
          description={
            many ? `A mudança vale para os ${orderIds.length} pedidos deste cliente.` : "A mudança vale para este pedido."
          }
        >
          <div className="space-y-4">
            <Field label="Nome">
              <Input value={form.name} onChange={set("name")} maxLength={120} placeholder="Nome do cliente" />
            </Field>
            <Field
              label="Telefone / WhatsApp"
              hint={
                extraPhones
                  ? `Este cliente tem ${phones.length} telefones (${phones.map((p) => formatWhatsAppPhone(`55${p}`)).join(", ")}) — o campo substitui todos.`
                  : "DDD + número. Deixe vazio para remover."
              }
            >
              <Input
                inputMode="tel"
                value={form.phone}
                onChange={set("phone")}
                placeholder="(15) 99999-9999"
              />
            </Field>
            <Field
              label="E-mail"
              hint={
                extraEmails
                  ? `Este cliente tem ${emails.length} e-mails (${emails.join(", ")}) — o campo substitui todos.`
                  : "Em venda na loja, vazio volta ao e-mail genérico."
              }
            >
              <Input type="email" inputMode="email" value={form.email} onChange={set("email")} placeholder="cliente@email.com" />
            </Field>

            {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

            <div className={cn("flex items-center gap-3")}>
              <Button onClick={save} disabled={saving}>
                {saving ? <Spinner /> : "Salvar"}
              </Button>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
                Cancelar
              </Button>
            </div>
          </div>
        </ModalContent>
      </Modal>
    </>
  );
}
