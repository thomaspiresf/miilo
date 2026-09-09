import type { Category, Coupon, Order, Product, StockMovement } from "@/lib/types";
import { seedCategories, seedProducts } from "@/lib/data/seed";

/**
 * Estado em memória do MODO DEMONSTRAÇÃO.
 * Guardado em globalThis para sobreviver ao hot-reload do dev server.
 * Reinicia quando o processo reinicia — o que é aceitável para demonstração.
 */
type MockDB = {
  categories: Category[];
  products: Product[];
  orders: Order[];
  movements: StockMovement[];
  coupons: Coupon[];
};

const g = globalThis as unknown as { __miiloMock?: MockDB };

export function mockDB(): MockDB {
  if (!g.__miiloMock) {
    g.__miiloMock = {
      categories: structuredClone(seedCategories),
      products: structuredClone(seedProducts),
      orders: [],
      movements: [],
      coupons: [],
    };
  }
  return g.__miiloMock;
}
