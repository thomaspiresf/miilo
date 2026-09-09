import Image from "next/image";
import { Star } from "lucide-react";
import type { Review } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

function Stars({ n }: { n: number }) {
  return (
    <span className="flex">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn("h-3.5 w-3.5", i <= n ? "fill-yellow text-yellow" : "text-border")}
        />
      ))}
    </span>
  );
}

export function ProductReviews({ reviews }: { reviews: Review[] }) {
  if (reviews.length === 0) return null;

  return (
    <section className="max-w-2xl">
      <h2 className="mb-4 text-lg font-black">
        Avaliações ({reviews.length})
      </h2>
      <div className="space-y-5">
        {reviews.map((r) => (
          <div key={r.id} className="border-b border-border pb-5 last:border-0">
            <div className="flex items-center gap-2">
              <Stars n={r.rating} />
              <span className="text-sm font-semibold">
                {r.author_name || "Cliente"}
              </span>
              <span className="text-xs text-muted">· {formatDate(r.created_at)}</span>
            </div>
            {r.comment && (
              <p className="mt-2 whitespace-pre-line text-sm text-foreground/80">
                {r.comment}
              </p>
            )}
            {r.photos.length > 0 && (
              <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
                {r.photos.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border"
                  >
                    <Image
                      src={url}
                      alt={`Foto ${i + 1} da avaliação`}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
