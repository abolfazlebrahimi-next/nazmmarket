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
  Popcorn,
  Salad,
  SprayCan,
  Wheat,
} from "lucide-react";

export type Category = { id: string; name: string; icon: LucideIcon };

export const categories: Category[] = [
  { id: "all", name: "همه", icon: LayoutGrid },
  { id: "drinks", name: "نوشیدنی", icon: CupSoda },
  { id: "dairy", name: "لبنیات و تخم‌مرغ", icon: Milk },
  { id: "snacks", name: "تنقلات", icon: Cookie },
  { id: "grocery", name: "خواربار", icon: Wheat },
  { id: "fresh", name: "میوه و سبزی", icon: Carrot },
  { id: "protein", name: "پروتئینی", icon: Beef },
  { id: "bakery", name: "نان و شیرینی", icon: Croissant },
  { id: "hygiene", name: "بهداشتی", icon: SprayCan },
];

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

export const products: Product[] = [
  { id: 1, name: "نوشابه پرتقالی فانتا ۳۳۰ میلی‌لیتری", category: "drinks", price: 25400, oldPrice: 32000, unit: "قوطی ۳۳۰ میلی‌لیتری", icon: CupSoda, bg: "from-[#fff0dd] to-[#ffd3a1]", iconColor: "text-[#e86a00]", frequent: true },
  { id: 2, name: "نوشابه کولا خانواده ۱٫۵ لیتری", category: "drinks", price: 48500, oldPrice: 56000, unit: "بطری ۱٫۵ لیتری", icon: CupSoda, bg: "from-[#ffe9e9] to-[#f6c1c1]", iconColor: "text-[#c22f2f]" },
  { id: 3, name: "آب معدنی ۱٫۵ لیتری", category: "drinks", price: 12000, unit: "بطری ۱٫۵ لیتری", icon: GlassWater, bg: "from-[#e8f4ff] to-[#bfdcf7]", iconColor: "text-[#2f7fc2]", frequent: true },
  { id: 4, name: "دوغ نعنایی گازدار ۱٫۵ لیتری", category: "drinks", price: 38000, oldPrice: 44000, unit: "بطری ۱٫۵ لیتری", icon: GlassWater, bg: "from-[#e9f9ef] to-[#bde8cc]", iconColor: "text-[#1e9e62]" },
  { id: 5, name: "قهوه فوری ۲۰ عددی", category: "drinks", price: 96000, unit: "بسته ۲۰ عددی", icon: Coffee, bg: "from-[#f3e9e2] to-[#ddc4ae]", iconColor: "text-[#8a5a33]" },

  { id: 6, name: "شیر تازه پرچرب ۱ لیتری", category: "dairy", price: 42000, oldPrice: 46000, unit: "بطری ۱ لیتری", icon: Milk, bg: "from-[#eef5ff] to-[#cfdff5]", iconColor: "text-[#3a6fb5]", frequent: true },
  { id: 7, name: "ماست یونانی ۹۰۰ گرمی", category: "dairy", price: 68500, unit: "ظرف ۹۰۰ گرمی", icon: Milk, bg: "from-[#f2f7ff] to-[#d8e6f8]", iconColor: "text-[#54719c]" },
  { id: 8, name: "پنیر سفید ایرانی ۴۰۰ گرمی", category: "dairy", price: 89000, oldPrice: 99000, unit: "بسته ۴۰۰ گرمی", icon: Milk, bg: "from-[#fff7e0] to-[#f3df9f]", iconColor: "text-[#b8890b]" },
  { id: 9, name: "تخم‌مرغ تازه ۱۲ عددی", category: "dairy", price: 98000, oldPrice: 115000, unit: "شانه ۱۲ عددی", icon: Egg, bg: "from-[#fff3e2] to-[#f7d9ae]", iconColor: "text-[#c07f1a]", frequent: true },
  { id: 10, name: "کره حیوانی ۱۰۰ گرمی", category: "dairy", price: 54000, unit: "قالب ۱۰۰ گرمی", icon: Milk, bg: "from-[#fff8dc] to-[#f5e29a]", iconColor: "text-[#a8840d]" },

  { id: 11, name: "چیپس نمکی ۱۴۰ گرمی", category: "snacks", price: 28000, oldPrice: 100000, unit: "بسته ۱۴۰ گرمی", icon: Popcorn, bg: "from-[#f3eaff] to-[#d3bdf7]", iconColor: "text-[#7b4bc4]", tag: "فقط ۲ عدد مانده!" },
  { id: 12, name: "ویفر شکلاتی ۱۲۰ گرمی", category: "snacks", price: 18500, oldPrice: 35000, unit: "بسته ۱۲۰ گرمی", icon: Cookie, bg: "from-[#ffecec] to-[#f3bcbc]", iconColor: "text-[#b03a3a]", frequent: true },
  { id: 13, name: "شکلات تخته‌ای شیری ۱۰۰ گرمی", category: "snacks", price: 45000, oldPrice: 52000, unit: "تخته ۱۰۰ گرمی", icon: Candy, bg: "from-[#f7ece4] to-[#dec0a8]", iconColor: "text-[#7d4a26]" },
  { id: 14, name: "کیک مغزدار دوقلو", category: "snacks", price: 10000, oldPrice: 40000, unit: "بسته دوقلو", icon: CakeSlice, bg: "from-[#ffeee6] to-[#f5c6ac]", iconColor: "text-[#c25a1e]", tag: "فقط ۱۳ عدد مانده!" },
  { id: 15, name: "بستنی چوبی میوه‌ای", category: "snacks", price: 15000, oldPrice: 40000, unit: "عدد", icon: IceCreamCone, bg: "from-[#ffe9f4] to-[#f5bcd9]", iconColor: "text-[#c23a84]" },

  { id: 16, name: "روغن مایع سرخ‌کردنی ۹۰۰ میلی‌لیتری", category: "grocery", price: 78000, oldPrice: 86000, unit: "بطری ۹۰۰ میلی‌لیتری", icon: GlassWater, bg: "from-[#fff6da] to-[#eed88f]", iconColor: "text-[#a07d08]", frequent: true },
  { id: 17, name: "برنج ایرانی درجه‌یک ۵ کیلویی", category: "grocery", price: 895000, unit: "کیسه ۵ کیلویی", icon: Wheat, bg: "from-[#f5efdd] to-[#e2d3a4]", iconColor: "text-[#97742a]" },
  { id: 18, name: "ماکارونی رشته‌ای ۷۰۰ گرمی", category: "grocery", price: 32000, oldPrice: 37500, unit: "بسته ۷۰۰ گرمی", icon: Wheat, bg: "from-[#fff0d6] to-[#f2cf96]", iconColor: "text-[#b57a14]" },
  { id: 19, name: "رب گوجه‌فرنگی ۸۰۰ گرمی", category: "grocery", price: 58500, unit: "قوطی ۸۰۰ گرمی", icon: Salad, bg: "from-[#ffe9e4] to-[#f2b8a6]", iconColor: "text-[#bf4a26]" },

  { id: 20, name: "پرتقال تازه درجه‌یک", category: "fresh", price: 65000, oldPrice: 78000, unit: "۱ کیلوگرم", icon: Apple, bg: "from-[#fff1dc] to-[#ffc98a]", iconColor: "text-[#e07b00]", frequent: true },
  { id: 21, name: "گوجه‌فرنگی بوته‌ای", category: "fresh", price: 38000, unit: "۱ کیلوگرم", icon: Apple, bg: "from-[#ffe7e2] to-[#f5a894]", iconColor: "text-[#cf3f1f]" },
  { id: 22, name: "خیار رسمی", category: "fresh", price: 29000, unit: "۱ کیلوگرم", icon: Carrot, bg: "from-[#e9f9ec] to-[#a9dfb4]", iconColor: "text-[#1f8a3d]" },
  { id: 23, name: "سیب قرمز درختی", category: "fresh", price: 72000, oldPrice: 84000, unit: "۱ کیلوگرم", icon: Apple, bg: "from-[#ffe9ec] to-[#f2a9b4]", iconColor: "text-[#c22f47]" },
  { id: 24, name: "هویج تازه", category: "fresh", price: 34000, unit: "۱ کیلوگرم", icon: Carrot, bg: "from-[#fff0e0] to-[#f7bd7f]", iconColor: "text-[#d96f06]" },

  { id: 25, name: "مرغ تازه کامل", category: "protein", price: 185000, oldPrice: 205000, unit: "۱ کیلوگرم", icon: Fish, bg: "from-[#fdf0e4] to-[#f3cfa5]", iconColor: "text-[#b06f1e]" },
  { id: 26, name: "گوشت چرخ‌کرده مخلوط", category: "protein", price: 245000, unit: "۵۰۰ گرم", icon: Beef, bg: "from-[#ffe9e9] to-[#efa9a9]", iconColor: "text-[#b02a2a]" },
  { id: 27, name: "ماهی قزل‌آلا تازه", category: "protein", price: 320000, oldPrice: 360000, unit: "۱ کیلوگرم", icon: Fish, bg: "from-[#e6f4fb] to-[#a8d4ee]", iconColor: "text-[#1f6f9e]" },

  { id: 28, name: "نان سنگک سنتی", category: "bakery", price: 15000, unit: "عدد", icon: Croissant, bg: "from-[#f7ecd8] to-[#e3c491]", iconColor: "text-[#a8742a]", frequent: true },
  { id: 29, name: "شیرینی خشک یزدی ۵۰۰ گرمی", category: "bakery", price: 88000, oldPrice: 104000, unit: "جعبه ۵۰۰ گرمی", icon: Cookie, bg: "from-[#fdf3e3] to-[#eecfa1]", iconColor: "text-[#ad7a1f]" },

  { id: 30, name: "شامپو نرم‌کننده ۴۰۰ میلی‌لیتری", category: "hygiene", price: 98000, oldPrice: 118000, unit: "بطری ۴۰۰ میلی‌لیتری", icon: SprayCan, bg: "from-[#e9f1ff] to-[#b9cff5]", iconColor: "text-[#3863b8]" },
  { id: 31, name: "خمیردندان کامل ۱۰۰ گرمی", category: "hygiene", price: 45000, unit: "تیوب ۱۰۰ گرمی", icon: SprayCan, bg: "from-[#e7faf1] to-[#a5e3c2]", iconColor: "text-[#128a52]" },
  { id: 32, name: "مایع ظرفشویی ۱ لیتری", category: "hygiene", price: 52000, oldPrice: 61000, unit: "بطری ۱ لیتری", icon: SprayCan, bg: "from-[#fff6da] to-[#ecd67e]", iconColor: "text-[#99800c]" },
];

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

export const stores: Store[] = [
  { id: 1, name: "اسمارت ناز (سوپرمارکت زنجیره‌ای ناز)", type: "hypermarket", pro: true, isNew: true, minutes: 45, fee: 35400, area: "بلوار آیت‌الله کاشانی، مرکز نظرآباد", tags: ["تضمین تاریخ"], offText: "۱۵۰ هزار تومان تخفیف", gradient: "from-[#ff7a2f] to-[#f04400]", initial: "ناز", minBasket: 100000 },
  { id: 2, name: "دیلی مارکت خیابان شهید مطهری (همواره تخفیف)", type: "supermarket", pro: true, rating: 4.0, minutes: 29, fee: 33300, area: "خیابان شهید مطهری", tags: ["ارسال توربو"], offText: "۱۵۰ هزار تومان تخفیف", gradient: "from-[#ef4444] to-[#c81e1e]", initial: "دیلی", minBasket: 80000 },
  { id: 3, name: "دیلی مارکت الغدیر ۲ (همواره تخفیف)", type: "supermarket", isNew: true, minutes: 45, fee: 32200, area: "بلوار الغدیر جنوبی", tags: [], offText: "۱۵۰ هزار تومان تخفیف", gradient: "from-[#ef4444] to-[#b91c1c]", initial: "دیلی", minBasket: 80000 },
  { id: 4, name: "سوپرمارکت المهدی (سیدجمال‌الدین)", type: "supermarket", rating: 4.3, minutes: 29, fee: 33800, area: "محله سیدجمال‌الدین", tags: ["تضمین تاریخ", "ارسال توربو"], gradient: "from-[#ffb27d] to-[#f97316]", initial: "م", minBasket: 50000 },
  { id: 5, name: "هایپرمارکت بزرگ شهر نظرآباد", type: "hypermarket", rating: 4.6, minutes: 50, fee: 29000, area: "ورودی شهر، جنب میدان صنعت", tags: ["تضمین تاریخ"], offText: "۲۰۰ هزار تومان تخفیف", gradient: "from-[#0ea5a4] to-[#0f766e]", initial: "شهر", minBasket: 150000 },
  { id: 6, name: "سوپرمارکت شبانه‌روزی بهاران", type: "supermarket", rating: 4.2, minutes: 20, fee: 31000, area: "خیابان امام خمینی", tags: ["ارسال توربو", "۲۴ ساعته"], gradient: "from-[#6366f1] to-[#4338ca]", initial: "ب", minBasket: 40000 },
  { id: 7, name: "فروشگاه مرکزی تنکمان", type: "supermarket", isNew: true, minutes: 55, fee: 38000, area: "شهر تنکمان، خیابان اصلی", tags: [], offText: "۱۰۰ هزار تومان تخفیف", gradient: "from-[#f59e0b] to-[#d97706]", initial: "ت", minBasket: 90000 },
  { id: 8, name: "میوه و تره‌بار سبز نظرآباد", type: "supermarket", rating: 4.8, minutes: 35, fee: 27000, area: "میدان مرکزی، بازار روز", tags: ["تضمین تازگی"], gradient: "from-[#22c55e] to-[#15803d]", initial: "سبز", minBasket: 60000 },
];

export const discountCodes = [
  { code: "NAZ60", title: "تخفیف اولین خرید", desc: "۶۰٬۰۰۰ تومان تخفیف + ارسال رایگان", amount: 60000 },
  { code: "NAZ10", title: "تخفیف همگانی", desc: "۱۰٪ تخفیف تا سقف ۵۰٬۰۰۰ تومان", amount: 0 },
  { code: "NAZARABAD", title: "ویژه شهرستان نظرآباد", desc: "۲۵٬۰۰۰ تومان تخفیف خرید بالای ۴۰۰ هزار تومان", amount: 25000 },
];

export const MAP_EMBED =
  "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d51666.757483010166!2d50.65042583181039!3d35.967211758785865!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3f8cfe719cbef2b7%3A0xeb52356bc4b731b8!2z2YbYuNixINii2KjYp9iv2Iwg2KfYs9iq2KfZhiDYp9mE2KjYsdiy2Iwg2KfbjNix2KfZhg!5e0!3m2!1sfa!2s!4v1794226902610!5m2!1sfa!2s";

export const faNum = (n: number) => n.toLocaleString("fa-IR");

export type CartState = { storeId: number | null; items: Record<number, number> };
export type User = { phone: string; firstName: string; lastName: string };

export type OrderItem = { id: number; name: string; qty: number; price: number };
export type Order = {
  id: string;
  storeId: number | null;
  storeName: string;
  items: OrderItem[];
  total: number;
  addressTitle: string;
  slot: string;
  status: number;
  time: string;
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
