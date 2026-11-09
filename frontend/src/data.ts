import catalogData from "../../backend/shared/catalog.json";
import type { LucideIcon } from "lucide-react";
import {
  Apple,
  Beef,
  CakeSlice,
  Candy,
  Carrot,
  Coffee,
  Cookie,
  Croissant,
  CupSoda,
  Egg,
  Fish,
  GlassWater,
  IceCreamCone,
  LayoutGrid,
  Milk,
  Package,
  Popcorn,
  Salad,
  SprayCan,
  Wheat,
} from "lucide-react";

/**
 * Catalog types + client fallback data.
 *
 * The real data lives in `backend/shared/catalog.json`, which is seeded into the
 * backend database (MySQL) on boot and served by `GET /api/catalog`.
 * The bundled copy keeps the storefront usable before the first request
 * (and when the API is unreachable). Icons are rendered client-side, so the
 * API only ships an icon *name*.
 */
const ICONS: Record<string, LucideIcon> = {
  Apple,
  Beef,
  CakeSlice,
  Candy,
  Carrot,
  Coffee,
  Cookie,
  Croissant,
  CupSoda,
  Egg,
  Fish,
  GlassWater,
  IceCreamCone,
  LayoutGrid,
  Milk,
  Package,
  Popcorn,
  Salad,
  SprayCan,
  Wheat,
};

const icon = (name?: string) => ICONS[name ?? ""] ?? Package;

export type Category = { id: string; name: string; icon: LucideIcon };

export type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  oldPrice?: number;
  unit: string;
  icon: LucideIcon;
  bg: string;
  iconColor: string;
  tag?: string;
  frequent?: boolean;
};

export type Store = {
  id: number;
  name: string;
  type: "supermarket" | "hypermarket";
  pro?: boolean;
  isNew?: boolean;
  rating?: number;
  minutes: number;
  fee: number;
  area: string;
  tags: string[];
  offText?: string;
  gradient: string;
  initial: string;
  minBasket: number;
};

type WireProduct = Omit<Product, "icon"> & { icon?: string };
type WireCategory = { id: string; name: string; icon?: string };

const withIcon = (p: WireProduct): Product => ({ ...p, icon: icon(p.icon) });

/* `const` arrays mutated in place: every module that imported them sees the
   hydrated (server) data without any refactor. */
export const categories: Category[] = (catalogData.categories as WireCategory[]).map((c) => ({
  ...c,
  icon: icon(c.icon),
}));

export const products: Product[] = (catalogData.products as WireProduct[]).map(withIcon);
export const stores: Store[] = catalogData.stores as Store[];
export const brands: { name: string; color: string }[] = catalogData.brands;

export const discountCodes = catalogData.promos.map((p) => ({
  code: p.code,
  title: p.title,
  desc: p.desc,
  amount: p.amount,
}));

export type CatalogPayload = {
  products?: WireProduct[];
  stores?: Store[];
  categories?: WireCategory[];
  promos?: { code: string; title: string; desc: string; amount: number }[];
};

/** Replaces the bundled catalog with the fresh copy served by the API. */
export function hydrateCatalog(payload: CatalogPayload | null | undefined) {
  if (!payload) return;
  if (payload.products?.length) products.splice(0, products.length, ...payload.products.map(withIcon));
  if (payload.stores?.length) stores.splice(0, stores.length, ...payload.stores);
  if (payload.categories?.length)
    categories.splice(
      0,
      categories.length,
      ...payload.categories.map((c) => ({ ...c, icon: icon(c.icon) })),
    );
}

export const MAP_EMBED =
  "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d51666.757483010166!2d50.65042583181039!3d35.967211758785865!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1m1!1s0x3f8cfe719cbef2b7%3A0xeb52356bc4b731b8!5e0!3m2!1sfa!2s!4v1794226902610!5m2!1sfa!2s";

export const faNum = (n: number) => n.toLocaleString("fa-IR");

export type CartState = { storeId: number | null; items: Record<number, number> };
export type User = {
  id?: number;
  phone: string;
  firstName: string;
  lastName: string;
  wallet?: number;
  pro?: boolean;
};

export type OrderItem = { id: number; name: string; qty: number; price: number };
export type Order = {
  id: string;
  storeId: number | null;
  storeName: string;
  items: OrderItem[];
  subtotal?: number;
  discount?: number;
  delivery?: number;
  total: number;
  addressTitle: string;
  slot: string;
  payment?: "online" | "cash";
  promoCode?: string | null;
  status: number;
  time: string;
  createdAt?: string;
};

export type Address = {
  id: number;
  title: string;
  address: string;
  detail: string;
  phone: string;
  type: "home" | "work";
  lat?: number;
  lng?: number;
};

export const discountOf = (p: Product) =>
  p.oldPrice ? Math.round(((p.oldPrice - p.price) / p.oldPrice) * 100) : 0;

export const productById = (id: number) => products.find((p) => p.id === id);
export const storeById = (id: number | null) => stores.find((s) => s.id === id);
