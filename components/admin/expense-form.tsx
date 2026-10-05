"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Camera, Paperclip, X } from "lucide-react";
import { createExpenseAction } from "@/app/admin/gastos/actions";
import { EXPENSE_CATEGORIES, EXPENSE_LABELS, EXPENSE_ITEM_TYPES, EXPENSE_PAYERS, ITEM_TYPE_LABELS, PAYER_LABELS } from "@/lib/expenses";
import { resizeImageForUpload } from "@/lib/image-resize";
import { formatBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/misc";

const SELECT_CLASS =
  "h-11 w-full rounded-xl border border-border bg-surface px-3 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

type Scan = {
  amount: number | null;
  date: string | null;
  merchant: string | null;
  description: string | null;
  category: string | null;
  itemType: string | null;
};

type Attachment = {
  path: string;
  previewUrl: string;
  /** o que a IA preencheu — pra avisar a pessoa de conferir */
  filled: string[];
  note: string | null;
};

export function ExpenseForm({ today }: { today: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [reading, setReading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const [state, action, pending] = useActionState(
    async (prev: unknown, formData: FormData) => {
      const res = await createExpenseAction(prev, formData);
      if (res && "ok" in res && res.ok) {
        setAttachment(null);
        setScanError(null);
      }
      return res;
    },
    null,
  );

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  function fieldEl(name: string) {
    return formRef.current?.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`) ?? null;
  }

  function setField(name: string, value: string) {
    const el = fieldEl(name);
    if (el) el.value = value;
  }

  function getField(name: string): string {
    return fieldEl(name)?.value ?? "";
  }

  async function onPickFile(file: File | undefined) {
    if (!file) return;
    setScanError(null);
    setReading(true);
    try {
      // nota precisa de mais resolução que foto de produto pra o texto ficar legível
      const resized = await resizeImageForUpload(file, { maxDimension: 2000 });
      const body = new FormData();
      body.append("file", resized);
      const res = await fetch("/api/admin/expenses/scan", { method: "POST", body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Falha ao enviar a nota");

      const scan: Scan | null = json.scan;
      const filled: string[] = [];
      if (scan) {
        if (scan.amount != null) {
          setField("amount", String(scan.amount).replace(".", ","));
          filled.push(`valor ${formatBRL(scan.amount)}`);
        }
        if (scan.date) {
          setField("spentOn", scan.date);
          filled.push("data");
        }
        if (scan.description) {
          setField("description", scan.description);
          filled.push("descrição");
        }
        if (scan.category && (EXPENSE_CATEGORIES as readonly string[]).includes(scan.category)) {
          setField("category", scan.category);
          filled.push("categoria");
        }
        if (scan.itemType && (EXPENSE_ITEM_TYPES as readonly string[]).includes(scan.itemType)) {
          setField("itemType", scan.itemType);
          filled.push("tipo");
        }
        if (scan.merchant && !getField("supplier")) {
          setField("supplier", scan.merchant);
          filled.push("fornecedor");
        }
      }
      setAttachment({
        path: json.path,
        previewUrl: URL.createObjectURL(resized),
        filled,
        note: scan ? null : "Não consegui ler a nota automaticamente — preencha os campos na mão. A imagem foi salva.",
      });
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Falha ao enviar a nota");
    } finally {
      setReading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function removeAttachment() {
    // a imagem já subiu pro bucket; sem anexo no gasto ela só fica órfã (sem custo relevante)
    setAttachment(null);
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="space-y-4 rounded-2xl border border-border bg-surface p-5"
    >
      <p className="font-bold">Novo gasto</p>

      {state?.error && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>
      )}
      {state?.ok && (
        <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">Gasto lançado!</p>
      )}

      <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.heic,.heif"
          className="hidden"
          onChange={(e) => onPickFile(e.target.files?.[0])}
        />
        {attachment ? (
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={attachment.previewUrl} alt="Nota anexada" className="h-16 w-16 shrink-0 rounded-lg border border-border object-cover" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="flex items-center gap-1 font-semibold">
                <Paperclip className="h-3.5 w-3.5" /> Nota anexada
              </p>
              {attachment.filled.length > 0 ? (
                <p className="text-xs text-muted">
                  A IA preencheu: {attachment.filled.join(", ")}. Confira antes de lançar.
                </p>
              ) : (
                <p className="text-xs text-warning">{attachment.note}</p>
              )}
            </div>
            <button
              type="button"
              onClick={removeAttachment}
              aria-label="Remover anexo"
              className="rounded-lg p-1.5 text-muted hover:bg-black/5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" size="sm" disabled={reading} onClick={() => fileRef.current?.click()}>
              {reading ? <Spinner /> : <Camera className="h-4 w-4" />}
              {reading ? "Lendo a nota…" : "Anexar foto da nota"}
            </Button>
            <span className="text-xs text-muted">
              A IA lê o valor, a data e o fornecedor e preenche os campos pra você conferir.
            </span>
          </div>
        )}
        {scanError && <p className="text-xs text-danger">{scanError}</p>}
        <input type="hidden" name="receiptPath" value={attachment?.path ?? ""} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Data">
          <Input name="spentOn" type="date" required defaultValue={today} />
        </Field>
        <Field label="Categoria">
          <select name="category" required defaultValue="mercadoria" className={SELECT_CLASS}>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {EXPENSE_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tipo" hint="Opcional. O que foi comprado.">
          <select name="itemType" defaultValue="" className={SELECT_CLASS}>
            <option value="">Sem tipo</option>
            {EXPENSE_ITEM_TYPES.map((t) => (
              <option key={t} value={t}>
                {ITEM_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Quem pagou" hint="Cada núcleo de sócios ou o caixa da loja.">
          <select name="payer" required defaultValue="" className={SELECT_CLASS}>
            <option value="" disabled>
              Escolha…
            </option>
            {EXPENSE_PAYERS.map((p) => (
              <option key={p} value={p}>
                {PAYER_LABELS[p]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Descrição" hint="Ex.: Compra Brás — bodies, Internet, Meta Ads.">
          <Input name="description" required maxLength={160} placeholder="O que foi?" />
        </Field>
        <Field label="Valor (R$)">
          <Input name="amount" inputMode="decimal" required placeholder="0,00" />
        </Field>
        <Field label="Fornecedor" hint="Opcional.">
          <Input name="supplier" maxLength={120} />
        </Field>
        <Field label="Observação" hint="Opcional.">
          <Input name="notes" maxLength={500} />
        </Field>
      </div>

      <Button type="submit" disabled={pending || reading}>
        {pending ? <Spinner /> : "Lançar gasto"}
      </Button>
    </form>
  );
}
