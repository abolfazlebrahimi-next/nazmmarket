import type { Address, CartState, Order, Product, Store as StoreType, User } from "./data";

export type View = "home" | "easy" | "cart" | "orders" | "account";

export type Sub =
  | { name: "store"; id: number }
  | { name: "category"; id: string }
  | { name: "search" }
  | { name: "favorites" }
  | { name: "account-detail"; id: "codes" | "payments" | "reviews" }
  | { name: "map" }
  | { name: "stores" }
  | { name: "address" }
  | { name: "address-form" }
  | { name: "checkout" }
  | { name: "done"; order: Order }
  | null;

export type LatLng = { lat: number; lng: number };

export interface CardHandlers {
  qtyOf(id: number): number;
  onAdd(p: Product): void;
  onDec(id: number): void;
  onOpen(p: Product): void;
  isFav(id: number): boolean;
  onFav(id: number): void;
}

/**
 * Central context passed to every page.
 * Keeping the whole app state in one place makes it easy to
 * swap the localStorage layer for real backend calls later.
 */
export interface AppCtx {
  user: User | null;
  /** true when the visitor chose "ادامه به عنوان مهمان" (no server session) */
  isGuest: boolean;
  logout(): void;
  /** keeps the header/account views in sync after a profile edit */
  updateUser(u: User): void;

  view: View;
  go(v: View): void;
  sub: Sub;
  openSub(s: NonNullable<Sub>): void;
  closeSub(): void;
  openAddress(ret: "home" | "checkout"): void;
  subReturn: "home" | "checkout";

  // catalog actions
  qtyOf(id: number): number;
  handleAdd(p: Product, storeId?: number): void;
  handleDec(id: number): void;
  clearCart(): void;
  cardHandlers(fromStoreId?: number): CardHandlers;

  // favorites
  favorites: number[];
  isFav(id: number): boolean;
  toggleFav(id: number): void;

  // addresses
  addresses: Address[];
  setAddresses(a: Address[]): void;
  selectedAddressId: number;
  setSelectedAddressId(id: number): void;
  selectedAddress: Address | undefined;
  pickedPin: LatLng | null;
  setPickedPin(p: LatLng | null): void;
  pickedLabel: string;
  setPickedLabel(s: string): void;

  // cart & money
  cart: CartState;
  cartCount: number;
  subtotal: number;
  cartStore: StoreType | null;
  appliedCode: string | null;
  setAppliedCode(c: string | null): void;
  discountAmount: number;
  deliveryFee: number;
  payable: number;
  applyCode(c: string): void;
  placeOrder(extra?: { slot?: string; payment?: "online" | "cash" }): Promise<void>;
  reorder(o: Order): void;
  orders: Order[];

  // account extras
  wallet: number;
  setWallet(w: number): void;

  // ui
  productModal: Product | null;
  openProduct(p: Product): void;
  closeProduct(): void;
  storePicker: boolean;
  openStorePicker(): void;
  closeStorePicker(): void;
  replacePrompt: { product: Product; storeId: number } | null;
  confirmReplace(): void;
  closeReplace(): void;
  pickStore(id: number): void;
  sheet: string | null;
  setSheet(s: string | null): void;
  cartDrawer: boolean;
  setCartDrawer(v: boolean): void;
  toast(msg: string): void;
}
