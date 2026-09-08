"use client";

import { SlidersHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Filters } from "@/components/site/filters";

export function MobileFilters({ sizes }: { sizes: string[] }) {
  return (
    <Sheet>
      <SheetTrigger className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold lg:hidden">
        <SlidersHorizontal className="h-4 w-4" />
        Filtrar
      </SheetTrigger>
      <SheetContent side="bottom" title="Filtros">
        <div className="p-4">
          <Filters sizes={sizes} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
