import type { DiscountCode } from "./discountCodes";
import type {
  Address,
  CartState,
  Order,
  Product,
  Store as StoreType,
  User,
} from "./data";

export type View = "home" | "easy" | "cart" | "orders" | "account";

export type Sub =
  | { name: "store"; id: number }
  | { name: "category"; id: string }
  | {
      name: "search";
      /** initial search term */
      q?: string;
      /** restrict results to one category */
      catId?: string;
      /** restrict results to one store */
      storeId?: number;
    }
  | { name: "favorites" }
  | { name: "order-history" }
  | { name: "account-detail"; id: "codes" | "payments" }
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
  /**
   * Opens the login/register overlay for guests. After a successful login the
   * app continues to `next` ("checkout" resumes the interrupted purchase).
   */
  requireLogin(next?: View | "checkout"): void;

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
  /** The matched code behind `appliedCode`, with its family and limits. */
  appliedPromo: DiscountCode | null;
  /** What `appliedCode` is worth on its own, before the first-order offer. */
  codeDiscount: number;
  discountAmount: number;
  deliveryFee: number;
  payable: number;
  applyCode(c: string): void;
  placeOrder(extra?: {
    slot?: string;
    payment?: "online" | "cash" | "wallet";
    deliveryMode?: "courier" | "pickup";
  }): Promise<void>;
  /** «ارسال با پیک» یا «دریافت حضوری» — در همهٔ مراحل خرید اعمال می‌شود. */
  orderDeliveryMode: "courier" | "pickup";
  setOrderDeliveryMode(m: "courier" | "pickup"): void;
  reorder(o: Order): void;
  orders: Order[];
  /** Re-pulls the order list after a customer action (cancel / change store). */
  refreshOrders(): Promise<void>;
  firstOrderEligible: boolean;
  firstOrderProductId: number | null;
  setFirstOrderProductId(id: number | null): void;
  firstOrderDiscount: number;
  /** باقی‌مانده تا حداقل مبلغ سبد برای تکمیل خرید (حداقل فروشگاه + حداقل «خرید اول» فعال). */
  checkoutMinLeft: number;
  /** انتخاب/تعویض «خرید اول»: فقط یک کالا؛ انتخاب دوم جایگزین اولی می‌شود. */
  selectFirstOffer(product: Product, storeId: number): void;

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
