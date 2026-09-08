"use client";

import { useState } from "react";
import { Truck } from "lucide-react";
import { formatBRL, formatCep } from "@/lib/format";
import { onlyDigits } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";
import type { ShippingOption } from "@/lib/types";

/** Estimativa de frete na página do produto (1 unidade). */
export function CepEstimate({ weightGrams, price }: { weightGrams: number; price: number }) {
  const [cep, setCep] = useState("");
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<ShippingOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function estimate() {
    const d = onlyDigits(cep);
    if (d.length !== 8) {
      setError("Digite um CEP válido.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/shipping/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cep: d, items: [{ qty: 1, weightGrams, unitPrice: price }] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível calcular.");
      setOptions(data.options);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro no cálculo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-sm font-bold">
        <Truck className="h-4 w-4" /> Entrega
      </p>
      <div className="flex gap-2">
        <Input
          inputMode="numeric"
          value={formatCep(cep)}
          onChange={(e) => setCep(onlyDigits(e.target.value))}
          onKeyDown={(e) => e.key === "Enter" && estimate()}
          placeholder="Insira seu CEP"
        />
        <Button variant="outline" onClick={estimate} disabled={loading} className="shrink-0">
          {loading ? <Spinner /> : "Calcular"}
        </Button>
      </div>
      <a
        href="https://buscacepinter.correios.com.br/app/endereco/index.php"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 inline-block text-xs text-muted underline underline-offset-2"
      >
        Não sei meu CEP
      </a>

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      {options && (
        <ul className="mt-3 space-y-1.5 text-sm">
          {options.map((o) => (
            <li key={o.id} className="flex items-center justify-between">
              <span>
                {o.company} {o.service}
                {o.delivery_days > 0 && (
                  <span className="text-muted"> · até {o.delivery_days} dias úteis</span>
                )}
              </span>
              <span className="font-bold">
                {o.price === 0 ? "Grátis" : formatBRL(o.price)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
