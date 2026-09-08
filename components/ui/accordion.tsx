import { ChevronDown } from "lucide-react";

/** Acordeão simples baseado em <details> nativo. */
export function Accordion({
  title,
  children,
  defaultOpen,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="group border-b border-border py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between font-bold [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown className="h-5 w-5 text-muted transition group-open:rotate-180" />
      </summary>
      <div className="mt-3 text-sm leading-relaxed text-muted">{children}</div>
    </details>
  );
}
