export type CategoryKind = "roupas" | "brinquedos";

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
  fit_notes: string | null;
  care_notes: string | null;
  rating_avg: number | null;
  rating_count: number;
  max_installments: number;
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
  created_at: string;
  items: OrderItem[];
};

export type StockReason = "sale" | "restock" | "adjustment" | "cancellation";

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
};

export type VariantStockRow = {
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  productActive: boolean;
  label: string;
  sku: string | null;
  price: number;
  stock: number;
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
