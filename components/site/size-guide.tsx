"use client";

import { Ruler } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const ROWS = [
  { size: "RN", months: "0–1 mês", height: "até 50 cm", weight: "até 4 kg" },
  { size: "P", months: "1–3 meses", height: "51–59 cm", weight: "4–6 kg" },
  { size: "M", months: "3–6 meses", height: "60–67 cm", weight: "6–8 kg" },
  { size: "G", months: "6–9 meses", height: "68–71 cm", weight: "8–9 kg" },
  { size: "GG", months: "9–12 meses", height: "72–76 cm", weight: "9–11 kg" },
];

export function SizeGuide() {
  return (
    <Sheet>
      <SheetTrigger className="inline-flex items-center gap-2 text-sm font-semibold text-foreground underline-offset-4 hover:underline">
        <Ruler className="h-4 w-4" />
        Guia de tamanhos
      </SheetTrigger>
      <SheetContent side="bottom" title="Guia de tamanhos">
        <div className="p-4">
          <p className="mb-3 text-sm text-muted">
            Referência por idade, altura e peso. Na dúvida entre dois tamanhos,
            escolha o maior.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="py-2 pr-3 font-semibold">Tam.</th>
                  <th className="py-2 pr-3 font-semibold">Idade</th>
                  <th className="py-2 pr-3 font-semibold">Altura</th>
                  <th className="py-2 font-semibold">Peso</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r) => (
                  <tr key={r.size} className="border-b border-border/60">
                    <td className="py-2 pr-3 font-bold">{r.size}</td>
                    <td className="py-2 pr-3">{r.months}</td>
                    <td className="py-2 pr-3">{r.height}</td>
                    <td className="py-2">{r.weight}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
