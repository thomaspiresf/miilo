"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

export function SearchBox({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(defaultValue);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    router.replace(term ? `/busca?q=${encodeURIComponent(term)}` : "/busca");
  }

  return (
    <form onSubmit={submit}>
      <div className="flex items-center rounded-full border border-border bg-surface px-3">
        <Search className="h-4 w-4 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar produtos"
          autoFocus
          className="h-11 w-full bg-transparent px-2 text-sm outline-none"
        />
      </div>
    </form>
  );
}
