import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function Rating({
  avg,
  count,
  size = "sm",
  showEmpty = true,
}: {
  avg: number | null;
  count: number;
  size?: "sm" | "md";
  showEmpty?: boolean;
}) {
  const px = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";

  if (!avg || count === 0) {
    if (!showEmpty) return null;
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted">
        <Star className={cn(px)} />
        Sem avaliação ainda
      </span>
    );
  }

  const full = Math.round(avg);
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted">
      <span className="flex">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn(px, i < full ? "fill-yellow text-yellow" : "text-border")}
          />
        ))}
      </span>
      {size === "md" && <span className="font-semibold text-foreground">{avg.toFixed(1)}</span>}
      <span>({count})</span>
    </span>
  );
}
