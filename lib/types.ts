export type CategoryKind = "roupas" | "brinquedos" | "livros";

/** Categorias principais (nível 1), na ordem em que aparecem na loja. */
export const CATEGORY_KINDS: CategoryKind[] = ["roupas", "brinquedos", "livros"];

export const KIND_LABELS: Record<CategoryKind, string> = {
  roupas: "Roupas",
  brinquedos: "Brinquedos",
  livros: "Livros",
};

/** Produtos que não são roupa: preço/estoque simples + Material/Medidas. */
export function isSimpleKind(kind: CategoryKind | null | undefined) {
  return kind === "brinquedos" || kind === "livros";
}

export type Category = {
  id: string;
  slug: string;
  name: string;
  kind: CategoryKind;
  sort: number;
};

export type ProductImage = {
  id: string;
  url: string;
  alt: string | null;
  sort: number;
  /** cor da variação a que a foto pertence; null = vale para todas */
  color: string | null;
};

export type ProductVariant = {
  id: string;
  sku: string | null;
  size: string | null;
  color: string | null;
  color_hex: string | null;
  price: number;
  stock: number;
  weight_grams: number;
  active: boolean;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  brand: string | null;
  gender: "menino" | "menina" | "unissex" | null;
  age_min_months: number | null;
  age_max_months: number | null;
  active: boolean;
  base_price: number;
  compare_at_price: number | null;
  composition: string | null;
  /** brinquedos: material (ex.: "Plástico ABS", "Madeira") */
  material: string | null;
  /** brinquedos: medidas (ex.: "30 cm de altura") */
  dimensions: string | null;
  fit_notes: string | null;
  care_notes: string | null;
  rating_avg: number | null;
  rating_count: number;
  max_installments: number;
  /** vídeo do produto: URL pública de um MP4 hospedado OU link YouTube/Vimeo */
  video_url: string | null;
  /** true = cada cor vira um card na vitrine; false = um card só pro produto */
  split_by_color: boolean;
  category: Pick<Category, "id" | "slug" | "name" | "kind">;
  images: ProductImage[];
  variants: ProductVariant[];
  /** menor preço entre as variações (ou base_price) */
  price_from: number;
  /** maior "preço de" correspondente (para o riscado), ou null */
  compare_at_from: number | null;
  in_stock: boolean;
};

export type ProductListItem = Omit<Product, "description" | "variants"> & {
  variant_count: number;
};

export type CatalogFilters = {
  categorySlug?: string;
  kind?: CategoryKind;
  q?: string;
  sizes?: string[];
  gender?: string;
  minPrice?: number;
  maxPrice?: number;
  ageMonths?: number;
  sort?: "relevancia" | "preco-asc" | "preco-desc" | "novidades";
};

export type Address = {
  id: string;
  recipient: string;
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  state: string;
  is_default: boolean;
};

export type ShippingOption = {
  id: string;
  company: string;
  service: string;
  price: number;
  delivery_days: number;
};

export type OrderStatus =
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "shipped"
  | "delivered";

export type OrderItem = {
  id: string;
  variant_id: string;
  product_name: string;
  variant_label: string | null;
  unit_price: number;
  qty: number;
  image_url: string | null;
};

export type DeliveryMode = "delivery" | "pickup";

/** Origem do pedido: loja online ou venda presencial (PDV). */
export type OrderChannel = "online" | "pos";

export type Coupon = {
  id: string;
  code: string;
  percent_off: number;
  min_subtotal: number | null;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  active: boolean;
  created_at: string;
};

export type Order = {
  id: string;
  number: string;
  user_id: string | null;
  email: string;
  customer_name: string | null;
  phone: string | null;
  delivery_mode: DeliveryMode;
  channel: OrderChannel;
  status: OrderStatus;
  subtotal: number;
  shipping_cost: number;
  shipping_service: string | null;
  total: number;
  /** Desconto de cupom aplicado (em reais). 0 = sem cupom. */
  discount: number;
  coupon_code: string | null;
  address: {
    cep: string;
    street: string;
    number: string;
    complement?: string | null;
    district: string;
    city: string;
    state: string;
  } | null;
  mp_payment_id: string | null;
  mp_status: string | null;
  payment_method: string | null;
  tracking_code: string | null;
  stock_restored: boolean;
  /** Estoque baixado na criação do pedido (reserva). */
  stock_reserved: boolean;
  created_at: string;
  items: OrderItem[];
};

export type Review = {
  id: string;
  product_id: string;
  author_name: string | null;
  rating: number;
  comment: string | null;
  photos: string[]; // URLs resolvidas
  created_at: string;
};

export type StockReason =
  | "sale"
  | "restock"
  | "adjustment"
  | "cancellation"
  | "reservation"
  | "reservation_release";

export type StockMovement = {
  id: string;
  variant_id: string | null;
  delta: number;
  reason: StockReason;
  note: string | null;
  order_id: string | null;
  balance_after: number | null;
  created_at: string;
  /** preenchido nas listagens do admin */
  product_name?: string;
  variant_label?: string | null;
  product_image?: string | null;
};

export type VariantStockRow = {
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  productActive: boolean;
  label: string;
  color: string | null;
  colorHex: string | null;
  size: string | null;
  sku: string | null;
  price: number;
  stock: number;
  /** foto da cor desta variação (ou a 1ª foto do produto). */
  imageUrl: string | null;
};

export type CartLine = {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  variantLabel: string | null;
  unitPrice: number;
  qty: number;
  imageUrl: string | null;
  maxStock: number;
  weightGrams: number;
};
