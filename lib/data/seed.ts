import type { Category, Product } from "@/lib/types";

/**
 * Catálogo de exemplo do MODO DEMONSTRAÇÃO (sem Supabase configurado).
 * No começo a loja vende só bodies — as outras categorias já existem no
 * schema para quando o catálogo crescer.
 */

export const seedCategories: Category[] = [
  // Roupas
  { id: "cat-bodies", slug: "bodies", name: "Bodies", kind: "roupas", sort: 1 },
  { id: "cat-conjuntos", slug: "conjuntos", name: "Conjuntos", kind: "roupas", sort: 2 },
  { id: "cat-mijao", slug: "mijao", name: "Mijão", kind: "roupas", sort: 3 },
  { id: "cat-shorts", slug: "shorts", name: "Shorts", kind: "roupas", sort: 4 },
  // Brinquedos
  { id: "cat-pelucias", slug: "pelucias", name: "Pelúcias", kind: "brinquedos", sort: 5 },
];

function img(seed: string, i: number) {
  return {
    id: `${seed}-img-${i}`,
    url: `https://picsum.photos/seed/${seed}${i}/900/1100`,
    alt: null,
    sort: i,
    color: null as string | null,
  };
}

type SeedVariant = {
  size?: string;
  color?: string;
  colorHex?: string;
  price: number;
  compareAt?: number;
  stock: number;
  weight?: number;
};

type SeedInput = {
  id: string;
  slug: string;
  name: string;
  description: string;
  categoryId: string;
  brand: string;
  gender: Product["gender"];
  ageMin: number | null;
  ageMax: number | null;
  images: number;
  composition: string;
  material?: string;
  dimensions?: string;
  fit: string;
  care: string;
  rating?: [number, number];
  variants: SeedVariant[];
};

const CARE_DEFAULT =
  "Lave à mão ou em ciclo delicado com água fria. Não use alvejante. Seque à sombra. Passe em temperatura baixa se necessário.";

const rawProducts: SeedInput[] = [
  {
    id: "p-body-basico",
    slug: "body-manga-longa-basico",
    name: "Body manga longa básico",
    description:
      "Body de manga longa em suedine de algodão penteado. Gola envelope para vestir com facilidade e abertura por botões de pressão no entrepernas. A peça que não pode faltar na gaveta do bebê.",
    categoryId: "cat-bodies",
    brand: "miilo baby",
    gender: "unissex",
    ageMin: 0,
    ageMax: 24,
    images: 4,
    composition: "100% algodão",
    fit: "Modelagem tradicional, folgada no corpo. Se o bebê estiver entre dois tamanhos, escolha o maior.",
    care: CARE_DEFAULT,
    rating: [4.9, 38],
    variants: [
      { size: "RN", color: "Branco", colorHex: "#f4f1ea", price: 39.9, stock: 20, weight: 120 },
      { size: "P", color: "Branco", colorHex: "#f4f1ea", price: 39.9, stock: 24, weight: 130 },
      { size: "M", color: "Branco", colorHex: "#f4f1ea", price: 42.9, stock: 12, weight: 140 },
      { size: "G", color: "Branco", colorHex: "#f4f1ea", price: 42.9, stock: 6, weight: 150 },
      { size: "RN", color: "Azul bebê", colorHex: "#89baff", price: 39.9, stock: 8, weight: 120 },
      { size: "P", color: "Azul bebê", colorHex: "#89baff", price: 39.9, stock: 10, weight: 130 },
      { size: "M", color: "Azul bebê", colorHex: "#89baff", price: 42.9, stock: 0, weight: 140 },
      { size: "P", color: "Rosa bebê", colorHex: "#ff83aa", price: 39.9, stock: 9, weight: 130 },
      { size: "M", color: "Rosa bebê", colorHex: "#ff83aa", price: 42.9, stock: 5, weight: 140 },
    ],
  },
  {
    id: "p-body-kit3",
    slug: "kit-3-bodies-manga-curta",
    name: "Kit 3 bodies manga curta",
    description:
      "Trio de bodies de manga curta em cores que combinam entre si. Malha leve e respirável, perfeita para os dias quentes. Melhor custo por peça da loja.",
    categoryId: "cat-bodies",
    brand: "miilo baby",
    gender: "unissex",
    ageMin: 0,
    ageMax: 18,
    images: 3,
    composition: "96% algodão, 4% elastano",
    fit: "Ajuste próximo ao corpo, sem apertar. Veste no tamanho.",
    care: CARE_DEFAULT,
    rating: [4.8, 21],
    variants: [
      { size: "RN", color: "Neutro", colorHex: "#e7ddcf", price: 89.9, compareAt: 119.7, stock: 14, weight: 300 },
      { size: "P", color: "Neutro", colorHex: "#e7ddcf", price: 89.9, compareAt: 119.7, stock: 18, weight: 320 },
      { size: "M", color: "Neutro", colorHex: "#e7ddcf", price: 94.9, compareAt: 124.7, stock: 7, weight: 340 },
      { size: "G", color: "Neutro", colorHex: "#e7ddcf", price: 94.9, compareAt: 124.7, stock: 0, weight: 360 },
    ],
  },
  {
    id: "p-body-canelado",
    slug: "body-canelado-sem-manga",
    name: "Body canelado sem manga",
    description:
      "Body regata em malha canelada com bom caimento e toque macio. Ótimo para usar sozinho no calor ou como segunda pele por baixo de outras peças.",
    categoryId: "cat-bodies",
    brand: "miilo baby",
    gender: "unissex",
    ageMin: 0,
    ageMax: 24,
    images: 3,
    composition: "95% algodão, 5% elastano",
    fit: "Modelagem justa (canelado). Veste no tamanho, com elasticidade confortável.",
    care: CARE_DEFAULT,
    rating: [4.7, 12],
    variants: [
      { size: "P", color: "Off white", colorHex: "#efe9de", price: 44.9, stock: 15, weight: 110 },
      { size: "M", color: "Off white", colorHex: "#efe9de", price: 44.9, stock: 11, weight: 120 },
      { size: "G", color: "Off white", colorHex: "#efe9de", price: 47.9, stock: 4, weight: 130 },
      { size: "P", color: "Caramelo", colorHex: "#c98a5b", price: 44.9, stock: 6, weight: 110 },
      { size: "M", color: "Caramelo", colorHex: "#c98a5b", price: 44.9, stock: 0, weight: 120 },
    ],
  },
  {
    id: "p-body-estampado",
    slug: "body-manga-longa-estampado",
    name: "Body manga longa estampado",
    description:
      "Body de manga longa com estampa exclusiva miilo em rotação total. Suedine de algodão com toque aveludado e costuras planas que não marcam a pele.",
    categoryId: "cat-bodies",
    brand: "miilo baby",
    gender: "unissex",
    ageMin: 0,
    ageMax: 18,
    images: 4,
    composition: "100% algodão",
    fit: "Modelagem tradicional. Veste no tamanho.",
    care: CARE_DEFAULT,
    rating: [5, 9],
    variants: [
      { size: "RN", color: "Nuvem", colorHex: "#aab6c6", price: 49.9, stock: 10, weight: 130 },
      { size: "P", color: "Nuvem", colorHex: "#aab6c6", price: 49.9, stock: 13, weight: 140 },
      { size: "M", color: "Nuvem", colorHex: "#aab6c6", price: 52.9, stock: 8, weight: 150 },
      { size: "RN", color: "Amarelo", colorHex: "#fdd307", price: 49.9, stock: 5, weight: 130 },
      { size: "P", color: "Amarelo", colorHex: "#fdd307", price: 49.9, stock: 7, weight: 140 },
    ],
  },
  {
    id: "p-body-golinha",
    slug: "body-com-golinha-de-tricoline",
    name: "Body com golinha de tricoline",
    description:
      "Body de malha com golinha e punhos em tricoline. O detalhe que transforma um look de dia a dia em produção de ocasião especial sem abrir mão do conforto.",
    categoryId: "cat-bodies",
    brand: "miilo baby",
    gender: "unissex",
    ageMin: 0,
    ageMax: 12,
    images: 3,
    composition: "Corpo 100% algodão; gola 100% algodão (tricoline)",
    fit: "Modelagem tradicional. Recomendamos um tamanho acima para bebês mais fortinhos.",
    care: "Lave à mão. Não torça a golinha. Seque na horizontal à sombra.",
    rating: [4.6, 7],
    variants: [
      { size: "RN", color: "Branco", colorHex: "#f4f1ea", price: 59.9, stock: 9, weight: 140 },
      { size: "P", color: "Branco", colorHex: "#f4f1ea", price: 59.9, stock: 12, weight: 150 },
      { size: "M", color: "Branco", colorHex: "#f4f1ea", price: 62.9, stock: 3, weight: 160 },
    ],
  },
  {
    id: "p-conjunto-body-mijao",
    slug: "conjunto-body-e-mijao-suedine",
    name: "Conjunto body + mijão em suedine",
    description:
      "Conjuntinho de body de manga longa com mijão de cós confortável, tudo em suedine de algodão. Sai pronto da gaveta, sem ter que combinar peças.",
    categoryId: "cat-conjuntos",
    brand: "miilo baby",
    gender: "unissex",
    ageMin: 0,
    ageMax: 12,
    images: 3,
    composition: "100% algodão (suedine)",
    fit: "Modelagem tradicional. Veste no tamanho.",
    care: CARE_DEFAULT,
    rating: [4.9, 14],
    variants: [
      { size: "RN", color: "Verde sálvia", colorHex: "#9fb3a0", price: 89.9, stock: 8, weight: 220 },
      { size: "P", color: "Verde sálvia", colorHex: "#9fb3a0", price: 89.9, stock: 10, weight: 240 },
      { size: "M", color: "Verde sálvia", colorHex: "#9fb3a0", price: 94.9, stock: 5, weight: 260 },
      { size: "P", color: "Cinza", colorHex: "#b9bcc2", price: 89.9, stock: 6, weight: 240 },
    ],
  },
  {
    id: "p-mijao-suedine",
    slug: "mijao-suedine-com-pe",
    name: "Mijão de suedine com pé",
    description:
      "Mijão (calça de bebê) com pezinho fechado e cós largo que não marca a barriga. Suedine de algodão que acompanha o bebê no berço e no colo.",
    categoryId: "cat-mijao",
    brand: "miilo baby",
    gender: "unissex",
    ageMin: 0,
    ageMax: 12,
    images: 3,
    composition: "100% algodão (suedine)",
    fit: "Cós sem elástico apertado. Comprimento generoso. Veste no tamanho.",
    care: CARE_DEFAULT,
    rating: [4.8, 9],
    variants: [
      { size: "RN", color: "Off white", colorHex: "#efe9de", price: 44.9, stock: 12, weight: 90 },
      { size: "P", color: "Off white", colorHex: "#efe9de", price: 44.9, stock: 15, weight: 100 },
      { size: "M", color: "Off white", colorHex: "#efe9de", price: 47.9, stock: 7, weight: 110 },
      { size: "P", color: "Nuvem", colorHex: "#aab6c6", price: 44.9, stock: 8, weight: 100 },
      { size: "M", color: "Nuvem", colorHex: "#aab6c6", price: 47.9, stock: 0, weight: 110 },
    ],
  },
  {
    id: "p-shorts-saruel",
    slug: "shorts-saruel-de-moletinho",
    name: "Shorts saruel de moletinho",
    description:
      "Shorts saruel de moletinho leve com cós de ribana e cordão decorativo. Fresquinho para o verão e fácil de combinar com qualquer body.",
    categoryId: "cat-shorts",
    brand: "miilo kids",
    gender: "unissex",
    ageMin: 6,
    ageMax: 36,
    images: 3,
    composition: "96% algodão, 4% elastano (moletinho)",
    fit: "Modelagem folgada (saruel). Se a criança estiver entre dois tamanhos, fique no menor.",
    care: "Lave do avesso com água fria. Não use secadora. Passe em temperatura baixa.",
    rating: [4.7, 6],
    variants: [
      { size: "P", color: "Areia", colorHex: "#d9cbb3", price: 54.9, compareAt: 69.9, stock: 9, weight: 120 },
      { size: "M", color: "Areia", colorHex: "#d9cbb3", price: 54.9, compareAt: 69.9, stock: 7, weight: 130 },
      { size: "G", color: "Areia", colorHex: "#d9cbb3", price: 57.9, compareAt: 72.9, stock: 3, weight: 140 },
      { size: "P", color: "Terracota", colorHex: "#c07a55", price: 54.9, compareAt: 69.9, stock: 5, weight: 120 },
    ],
  },
  {
    id: "p-urso-pelucia",
    slug: "urso-de-pelucia-30cm",
    name: "Urso de pelúcia 30 cm",
    description:
      "Urso de pelúcia antialérgico com enchimento siliconado e costuras reforçadas. Sem partes pequenas — seguro desde o nascimento. Lavável na máquina.",
    categoryId: "cat-pelucias",
    brand: "miilo toys",
    gender: "unissex",
    ageMin: 0,
    ageMax: null,
    images: 3,
    composition: "Tecido 100% poliéster; enchimento 100% fibra siliconada",
    material: "Pelúcia antialérgica (100% poliéster), enchimento em fibra siliconada",
    dimensions: "Aprox. 30 cm de altura sentado",
    fit: "Tamanho único, cerca de 30 cm.",
    care: "Lavável na máquina em saco de proteção, ciclo delicado. Seque à sombra.",
    rating: [5, 24],
    variants: [
      { size: "Único", color: "Caramelo", colorHex: "#c98a5b", price: 79.9, stock: 15, weight: 300 },
      { size: "Único", color: "Cinza", colorHex: "#b9bcc2", price: 79.9, stock: 12, weight: 300 },
    ],
  },
];

function shortSku(seed: string, i: number) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (h.toString(36).toUpperCase().slice(0, 5) + (i + 1)).padStart(6, "0");
}

function buildProduct(input: SeedInput): Product {
  const category = seedCategories.find((c) => c.id === input.categoryId)!;
  const variants = input.variants.map((v, i) => ({
    id: `${input.id}-v${i}`,
    sku: shortSku(input.id, i),
    size: v.size ?? null,
    color: v.color ?? null,
    color_hex: v.colorHex ?? null,
    price: v.price,
    stock: v.stock,
    weight_grams: v.weight ?? 300,
    active: true,
  }));
  const prices = variants.map((v) => v.price);
  const priceFrom = Math.min(...prices);
  const comparePairs = input.variants
    .map((v) => (v.compareAt && v.compareAt > v.price ? v.compareAt : null))
    .filter((v): v is number => v != null);
  const compareAtFrom = comparePairs.length ? Math.max(...comparePairs) : null;

  return {
    id: input.id,
    slug: input.slug,
    name: input.name,
    description: input.description,
    brand: input.brand,
    gender: input.gender,
    age_min_months: input.ageMin,
    age_max_months: input.ageMax,
    active: true,
    base_price: priceFrom,
    compare_at_price: compareAtFrom,
    composition: input.composition,
    material: input.material ?? null,
    dimensions: input.dimensions ?? null,
    fit_notes: input.fit,
    care_notes: input.care,
    rating_avg: input.rating?.[0] ?? null,
    rating_count: input.rating?.[1] ?? 0,
    max_installments: 3,
    video_url: null,
    split_by_color: true,
    category: { id: category.id, slug: category.slug, name: category.name, kind: category.kind },
    images: Array.from({ length: input.images }, (_, i) => img(input.id, i)),
    variants,
    price_from: priceFrom,
    compare_at_from: compareAtFrom,
    in_stock: variants.some((v) => v.stock > 0),
  };
}

export const seedProducts: Product[] = rawProducts.map(buildProduct);
