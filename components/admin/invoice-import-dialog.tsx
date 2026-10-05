"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, FileText, Plus, ScanLine, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalContent } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/misc";
import { importInvoiceItemsAction, type ImportItem, type ImportResult } from "@/app/admin/produtos/import-actions";
import { resizeImageForUpload } from "@/lib/image-resize";
import { formatBRL, parseMoney } from "@/lib/format";
import type { ExistingProduct, ScanItemResult, ScanResponse } from "@/lib/invoice-types";
import type { CategoryKind } from "@/lib/types";
import { cn } from "@/lib/utils";

type CategoryOption = { id: string; name: string; kind: CategoryKind };

type Row = {
  key: string;
  include: boolean;
  mode: "new" | "restock";
  name: string;
  quantity: string;
  cost: string;
  price: string;
  size: string;
  color: string;
  categoryId: string;
  productId: string;
  variantId: string;
  suggestedPrice: number | null;
};

const SELECT =
  "h-10 w-full rounded-xl border border-border bg-surface px-2.5 text-sm outline-none focus:border-primary";

let seq = 0;
const newKey = () => `r${++seq}`;
const money = (n: number) => String(n).replace(".", ",");

function rowFromScan(it: ScanItemResult, categories: CategoryOption[]): Row {
  const cat = it.kind ? categories.find((c) => c.kind === it.kind) : undefined;
  return {
    key: newKey(),
    include: true,
    mode: it.match ? "restock" : "new",
    name: it.name,
    quantity: String(it.quantity),
    cost: money(it.unitCost),
    price: it.suggestedPrice != null ? money(it.suggestedPrice) : "",
    size: it.size ?? "",
    color: it.color ?? "",
    categoryId: cat?.id ?? "",
    productId: it.match?.productId ?? "",
    variantId: it.match?.variantId ?? "",
    suggestedPrice: it.suggestedPrice,
  };
}

const blankRow = (): Row => ({
  key: newKey(),
  include: true,
  mode: "new",
  name: "",
  quantity: "1",
  cost: "",
  price: "",
  size: "",
  color: "",
  categoryId: "",
  productId: "",
  variantId: "",
  suggestedPrice: null,
});

/**
 * Cadastro de produtos por nota: lê a foto/PDF da nota com IA, mostra os itens (nome, quantidade,
 * custo, preço sugerido) pra você conferir e cadastra tudo de uma vez — produto novo (rascunho) ou
 * soma ao estoque de um produto que já existe.
 */
export function InvoiceImportDialog({
  categories,
  existing,
  variant = "outline",
}: {
  categories: CategoryOption[];
  existing: ExistingProduct[];
  variant?: "outline" | "primary";
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"pick" | "scanning" | "review" | "saving" | "done">("pick");
  const [rows, setRows] = useState<Row[]>([]);
  const [info, setInfo] = useState<{ supplier: string | null; date: string | null; message: string | null }>({
    supplier: null,
    date: null,
    message: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ImportResult[]>([]);

  function reset() {
    setStep("pick");
    setRows([]);
    setInfo({ supplier: null, date: null, message: null });
    setError(null);
    setResults([]);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      if (step === "done") router.refresh();
      reset();
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setStep("scanning");
    try {
      const prepared = file.type === "application/pdf" ? file : await resizeImageForUpload(file, { maxDimension: 2400 });
      const body = new FormData();
      body.append("file", prepared);
      const res = await fetch("/api/admin/products/scan-invoice", { method: "POST", body });
      const json = (await res.json().catch(() => ({}))) as ScanResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || "Falha ao ler a nota");
      setInfo({ supplier: json.supplier, date: json.invoiceDate, message: json.message ?? null });
      setRows(json.items.length > 0 ? json.items.map((it) => rowFromScan(it, categories)) : [blankRow()]);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao ler a nota");
      setStep("pick");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const patch = (key: string, p: Partial<Row>) => setRows((cur) => cur.map((r) => (r.key === key ? { ...r, ...p } : r)));

  function buildPayload(): { items: ImportItem[]; problem: string | null } {
    const items: ImportItem[] = [];
    for (const r of rows.filter((x) => x.include)) {
      const qty = Math.round(parseMoney(r.quantity) ?? NaN);
      const cost = r.cost.trim() === "" ? 0 : (parseMoney(r.cost) ?? NaN);
      if (!Number.isFinite(qty) || qty < 0) return { items, problem: `Quantidade inválida em “${r.name || "item"}”.` };
      if (!Number.isFinite(cost) || cost < 0) return { items, problem: `Custo inválido em “${r.name || "item"}”.` };
      if (r.mode === "new") {
        const price = parseMoney(r.price);
        if (r.name.trim().length < 2) return { items, problem: "Dê um nome a todos os produtos novos." };
        if (!r.categoryId) return { items, problem: `Escolha a categoria de “${r.name}”.` };
        if (price == null || price <= 0) return { items, problem: `Informe o preço de venda de “${r.name}”.` };
        items.push({
          mode: "new",
          name: r.name.trim(),
          categoryId: r.categoryId,
          size: r.size.trim() || null,
          color: r.color.trim() || null,
          quantity: qty,
          cost,
          price,
        });
      } else {
        if (!r.productId || !r.variantId) return { items, problem: `Escolha o produto e a variação de “${r.name || "item"}”.` };
        if (qty < 1) return { items, problem: `Quantidade da reposição de “${r.name || "item"}” deve ser ao menos 1.` };
        items.push({ mode: "restock", productId: r.productId, variantId: r.variantId, quantity: qty, cost: cost > 0 ? cost : null });
      }
    }
    return { items, problem: items.length === 0 ? "Marque ao menos um item." : null };
  }

  async function submit() {
    const { items, problem } = buildPayload();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setStep("saving");
    const res = await importInvoiceItemsAction(items);
    if (!res.ok) {
      setError(res.error);
      setStep("review");
      return;
    }
    setResults(res.results);
    setStep("done");
  }

  const selected = rows.filter((r) => r.include).length;
  const totalCost = rows
    .filter((r) => r.include)
    .reduce((s, r) => s + (parseMoney(r.cost) ?? 0) * (parseMoney(r.quantity) ?? 0), 0);

  return (
    <>
      <Button size="sm" variant={variant} onClick={() => setOpen(true)}>
        <ScanLine className="h-4 w-4" />
        Cadastrar por nota
      </Button>

      <Modal open={open} onOpenChange={onOpenChange}>
        <ModalContent
          title="Cadastrar produtos por nota"
          description="Envie a foto ou o PDF da nota de compra; a IA lê os itens e você confere antes de cadastrar."
          className="max-w-3xl"
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.heic,.heif,application/pdf"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />

          {(step === "pick" || step === "scanning") && (
            <div className="space-y-3">
              <button
                type="button"
                disabled={step === "scanning"}
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-10 text-center transition hover:border-foreground/40 disabled:opacity-70"
              >
                {step === "scanning" ? <Spinner className="h-6 w-6" /> : <FileText className="h-7 w-7 text-muted" />}
                <span className="text-sm font-semibold">
                  {step === "scanning" ? "Lendo a nota… (pode levar alguns segundos)" : "Escolher foto ou PDF da nota"}
                </span>
                <span className="text-xs text-muted">JPG, PNG, WebP, HEIC (iPhone) ou PDF · até 10 MB</span>
              </button>
              {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
              <button
                type="button"
                onClick={() => {
                  setRows([blankRow()]);
                  setStep("review");
                }}
                className="text-xs font-medium text-muted underline-offset-2 hover:text-foreground hover:underline"
              >
                Prefiro adicionar os itens na mão
              </button>
            </div>
          )}

          {(step === "review" || step === "saving") && (
            <div className="space-y-4">
              {(info.supplier || info.date || info.message) && (
                <div className="rounded-xl bg-black/[0.04] px-3 py-2 text-xs text-muted">
                  {info.supplier && <span className="mr-3 font-semibold text-foreground">{info.supplier}</span>}
                  {info.date && <span className="mr-3">nota de {info.date.split("-").reverse().join("/")}</span>}
                  {info.message && <span className="block text-warning">{info.message}</span>}
                </div>
              )}

              <div className="space-y-3">
                {rows.map((r) => {
                  const product = existing.find((p) => p.id === r.productId);
                  return (
                    <div
                      key={r.key}
                      className={cn("space-y-3 rounded-2xl border border-border p-3.5", !r.include && "opacity-50")}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={r.include}
                          onChange={(e) => patch(r.key, { include: e.target.checked })}
                          aria-label="Incluir este item"
                          className="h-4 w-4 shrink-0 accent-foreground"
                        />
                        <Input
                          value={r.name}
                          onChange={(e) => patch(r.key, { name: e.target.value })}
                          placeholder="Nome do produto"
                          className="h-10"
                        />
                        <button
                          type="button"
                          onClick={() => setRows((cur) => cur.filter((x) => x.key !== r.key))}
                          aria-label="Remover item"
                          className="shrink-0 rounded-lg p-2 text-muted hover:bg-danger/10 hover:text-danger"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="inline-flex rounded-full border border-border bg-black/[0.03] p-0.5 text-xs">
                        {(["new", "restock"] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => patch(r.key, { mode: m })}
                            className={cn(
                              "rounded-full px-3 py-1 font-medium transition",
                              r.mode === m ? "bg-background text-foreground shadow-sm" : "text-muted hover:text-foreground",
                            )}
                          >
                            {m === "new" ? "Produto novo" : "Somar ao estoque de um existente"}
                          </button>
                        ))}
                      </div>

                      {r.mode === "new" ? (
                        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-6">
                          <label className="col-span-2 text-[11px] font-medium text-muted sm:col-span-3">
                            Categoria
                            <select
                              value={r.categoryId}
                              onChange={(e) => patch(r.key, { categoryId: e.target.value })}
                              className={cn(SELECT, "mt-1 font-normal text-foreground")}
                            >
                              <option value="">Escolha…</option>
                              {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="text-[11px] font-medium text-muted sm:col-span-2">
                            Tamanho
                            <Input value={r.size} onChange={(e) => patch(r.key, { size: e.target.value })} className="mt-1 h-10" />
                          </label>
                          <label className="text-[11px] font-medium text-muted">
                            Cor
                            <Input value={r.color} onChange={(e) => patch(r.key, { color: e.target.value })} className="mt-1 h-10" />
                          </label>
                          <label className="text-[11px] font-medium text-muted sm:col-span-2">
                            Quantidade
                            <Input
                              inputMode="numeric"
                              value={r.quantity}
                              onChange={(e) => patch(r.key, { quantity: e.target.value })}
                              className="mt-1 h-10"
                            />
                          </label>
                          <label className="text-[11px] font-medium text-muted sm:col-span-2">
                            Custo unit. (R$)
                            <Input
                              inputMode="decimal"
                              value={r.cost}
                              onChange={(e) => patch(r.key, { cost: e.target.value })}
                              className="mt-1 h-10"
                            />
                          </label>
                          <label className="col-span-2 text-[11px] font-medium text-muted sm:col-span-2">
                            Preço de venda (R$)
                            <Input
                              inputMode="decimal"
                              value={r.price}
                              onChange={(e) => patch(r.key, { price: e.target.value })}
                              className="mt-1 h-10"
                            />
                          </label>
                          {r.suggestedPrice != null && (
                            <p className="col-span-full text-[11px] text-muted">
                              Sugerido pela Precificação: <span className="font-semibold text-foreground">{formatBRL(r.suggestedPrice)}</span>
                              {parseMoney(r.price) !== r.suggestedPrice && (
                                <button
                                  type="button"
                                  onClick={() => patch(r.key, { price: money(r.suggestedPrice!) })}
                                  className="ml-2 font-semibold text-primary hover:underline"
                                >
                                  usar
                                </button>
                              )}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-6">
                          <label className="col-span-2 text-[11px] font-medium text-muted sm:col-span-3">
                            Produto
                            <select
                              value={r.productId}
                              onChange={(e) => {
                                const p = existing.find((x) => x.id === e.target.value);
                                patch(r.key, { productId: e.target.value, variantId: p?.variants.length === 1 ? p.variants[0].id : "" });
                              }}
                              className={cn(SELECT, "mt-1 font-normal text-foreground")}
                            >
                              <option value="">Escolha…</option>
                              {existing.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="col-span-2 text-[11px] font-medium text-muted sm:col-span-3">
                            Variação
                            <select
                              value={r.variantId}
                              onChange={(e) => patch(r.key, { variantId: e.target.value })}
                              disabled={!product}
                              className={cn(SELECT, "mt-1 font-normal text-foreground")}
                            >
                              <option value="">Escolha…</option>
                              {product?.variants.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.label} (estoque {v.stock})
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="text-[11px] font-medium text-muted sm:col-span-3">
                            Quantidade a somar
                            <Input
                              inputMode="numeric"
                              value={r.quantity}
                              onChange={(e) => patch(r.key, { quantity: e.target.value })}
                              className="mt-1 h-10"
                            />
                          </label>
                          <label className="text-[11px] font-medium text-muted sm:col-span-3">
                            Novo custo unit. (R$)
                            <Input
                              inputMode="decimal"
                              value={r.cost}
                              onChange={(e) => patch(r.key, { cost: e.target.value })}
                              className="mt-1 h-10"
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setRows((cur) => [...cur, blankRow()])}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                <Plus className="h-4 w-4" /> Adicionar item
              </button>

              {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

              <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background px-1 pt-3">
                <p className="text-xs text-muted">
                  {selected} item{selected === 1 ? "" : "ns"} · custo total {formatBRL(totalCost)}
                  <span className="block">Produtos novos entram como rascunho (sem aparecer na loja) até você colocar a foto.</span>
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" onClick={reset} disabled={step === "saving"}>
                    Outra nota
                  </Button>
                  <Button onClick={submit} disabled={step === "saving" || selected === 0}>
                    {step === "saving" ? <Spinner /> : `Cadastrar ${selected} item${selected === 1 ? "" : "ns"}`}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="space-y-4">
              <ul className="divide-y divide-border rounded-2xl border border-border text-sm">
                {results.map((r) => (
                  <li key={r.index} className="flex items-start gap-2.5 px-3.5 py-2.5">
                    {r.ok ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    ) : (
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{r.label}</span>
                      {r.error && <span className="block text-xs text-danger">{r.error}</span>}
                    </span>
                    {r.ok && r.productId && (
                      <Link prefetch={false} href={`/admin/produtos/${r.productId}`} className="shrink-0 text-xs font-semibold text-primary hover:underline">
                        abrir
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted">
                Produtos novos foram criados como <strong>rascunho</strong>: abra cada um para colocar as fotos e ativar na loja.
              </p>
              <div className="flex items-center gap-2">
                <Button onClick={() => onOpenChange(false)}>Concluir</Button>
                <Button variant="ghost" onClick={reset}>
                  Cadastrar outra nota
                </Button>
              </div>
            </div>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
