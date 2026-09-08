import { HeroRabbit } from "@/components/site/hero-rabbit";

export function HeroBanner() {
  return (
    <section>
      <div className="relative h-52 w-full overflow-hidden rounded-3xl sm:h-64">
        <HeroRabbit />
      </div>
    </section>
  );
}
