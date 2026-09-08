import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Logo miilo. `variant` escolhe o arquivo:
 * - "horizontal": marca + coelho lado a lado (padrão, header)
 * - "wordmark": só a palavra "miilo"
 * - "icon": só o coelho
 * `tone` "positivo" (preto) para fundos claros, "negativo" (branco) para escuros.
 */
export function Logo({
  variant = "horizontal",
  tone = "positivo",
  className,
  priority,
}: {
  variant?: "horizontal" | "wordmark" | "icon";
  tone?: "positivo" | "negativo";
  className?: string;
  priority?: boolean;
}) {
  const files = {
    horizontal: { src: `/logo/2x/Horizontal_${tone}@2x.png`, w: 785, h: 200 },
    wordmark: { src: `/logo/2x/miilo_${tone}@2x.png`, w: 455, h: 167 },
    icon: { src: `/logo/2x/icon_${tone}@2x.png`, w: 410, h: 345 },
  } as const;
  const f = files[variant];

  return (
    <Image
      src={f.src}
      alt="miilo"
      width={f.w}
      height={f.h}
      priority={priority}
      className={cn("h-auto w-auto", className)}
    />
  );
}
