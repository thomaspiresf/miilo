import { HeroRabbit } from "@/components/site/hero-rabbit";

export function HeroBanner() {
  return (
    <section>
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-3xl">
        <HeroRabbit />
      </div>
    </section>
  );
}
