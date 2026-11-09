import { useCallback, useEffect, useState } from "react";
import { Bike, CheckCircle2, Clock3, LogOut, MapPin, PackageCheck, Phone, RefreshCw, ShieldCheck, Store } from "lucide-react";

type Courier = { id: number; fullName: string; phone: string; vehicle: string };
type DeliveryOrder = {
  id: string; storeName: string; storeAddress: string; storeArea: string; addressTitle: string; addressText: string;
  customerPhone: string; total: number; time: string; status: number; claimedByMe: boolean; items: { id: number; name: string; qty: number }[];
};
type ApiError = Error & { status?: number };
const TOKEN_KEY = "naz_courier_token";
const money = (n: number) => new Intl.NumberFormat("fa-IR").format(n);

async function request<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (auth && token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`/api/courier${path}`, { ...init, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message ?? "درخواست انجام نشد") as ApiError;
    error.status = response.status;
    throw error;
  }
  return data as T;
}

export default function CourierApp() {
  const [courier, setCourier] = useState<Courier | null>(null);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ fullName: "", phone: "", password: "" });

  const loadOrders = useCallback(async () => {
    if (!sessionStorage.getItem(TOKEN_KEY)) return;
    try {
      const data = await request<{ orders: DeliveryOrder[] }>("/orders");
      setOrders(data.orders);
      setError("");
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 401) { sessionStorage.removeItem(TOKEN_KEY); setCourier(null); }
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) return;
    request<{ courier: Courier }>("/auth/me").then((data) => setCourier(data.courier)).catch(() => sessionStorage.removeItem(TOKEN_KEY));
  }, []);
  useEffect(() => { if (courier) void loadOrders(); }, [courier, loadOrders]);

  const submitAuth = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setNotice(""); setError("");
    try {
      if (mode === "register") {
        const result = await request<{ message: string }>("/auth/register", { method: "POST", body: JSON.stringify({ ...form, vehicle: "motorcycle" }) }, false);
        setNotice(result.message); setMode("login");
      } else {
        const result = await request<{ token: string; courier: Courier }>("/auth/login", { method: "POST", body: JSON.stringify(form) }, false);
        sessionStorage.setItem(TOKEN_KEY, result.token); setCourier(result.courier);
      }
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  const mutateOrder = async (order: DeliveryOrder, action: "claim" | "complete") => {
    setBusy(true); setError("");
    try {
      await request(action === "claim" ? `/orders/${encodeURIComponent(order.id)}/claim` : `/orders/${encodeURIComponent(order.id)}/complete`, { method: "POST" });
      setNotice(action === "claim" ? "سفارش به شما واگذار شد؛ برای تکمیل، تحویل به مشتری را ثبت کنید." : "تحویل سفارش با موفقیت ثبت شد.");
      await loadOrders();
    } catch (e) { setError((e as Error).message); await loadOrders(); }
    finally { setBusy(false); }
  };

  const logout = async () => {
    try { await request("/auth/logout", { method: "POST" }); } catch { /* local session still gets cleared */ }
    sessionStorage.removeItem(TOKEN_KEY); setCourier(null); setOrders([]);
  };

  return <main className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-icon"><Bike size={23}/></span><span><b>نازمارکت</b><small>پنل مستقل پیک موتوری</small></span></div>{courier && <button className="logout" onClick={logout}><LogOut size={17}/> خروج</button>}</header>
    {!courier ? <section className="auth-card">
      <div className="hero-icon"><Bike size={30}/></div><h1>{mode === "login" ? "ورود پیک" : "ثبت‌نام پیک موتوری"}</h1>
      <p className="muted">دریافت و تکمیل سفارش فقط با حساب پیک تأییدشده امکان‌پذیر است.</p>
      <form onSubmit={submitAuth} className="auth-form">
        {mode === "register" && <label>نام و نام خانوادگی<input required maxLength={120} autoComplete="name" value={form.fullName} onChange={e=>setForm({...form,fullName:e.target.value})}/></label>}
        <label>شماره موبایل<input required inputMode="tel" autoComplete="tel" placeholder="09xxxxxxxxx" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label>
        <label>رمز عبور<input required minLength={mode === "register" ? 10 : 1} type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/>{mode === "register" && <small>حداقل ۱۰ نویسه</small>}</label>
        <button className="primary" disabled={busy}>{busy ? "لطفاً صبر کنید…" : mode === "login" ? "ورود امن" : "ارسال درخواست عضویت"}</button>
      </form>
      <button className="switch" onClick={()=>{setMode(mode === "login" ? "register" : "login");setError("");setNotice("");}}>{mode === "login" ? "حساب ندارید؟ ثبت‌نام پیک" : "قبلاً ثبت‌نام کرده‌اید؟ ورود"}</button>
      <div className="approval"><ShieldCheck size={17}/> حساب‌های تازه پس از بررسی مدیریت فعال می‌شوند.</div>
      {notice && <p className="notice">{notice}</p>}{error && <p className="error">{error}</p>}
    </section> : <>
      <section className="welcome"><div><p className="eyebrow">خوش آمدید</p><h1>{courier.fullName}</h1><p>{courier.phone} · پیک موتوری</p></div><button className="refresh" onClick={()=>void loadOrders()} aria-label="به‌روزرسانی"><RefreshCw size={18}/></button></section>
      {notice && <p className="notice banner">{notice}</p>}{error && <p className="error banner">{error}</p>}
      <div className="section-title"><div><h2>سفارش‌های آمادهٔ تحویل</h2><p>ابتدا سفارش را دریافت کنید؛ سپس تحویل به مشتری را ثبت کنید.</p></div><span className="count">{money(orders.length)}</span></div>
      {orders.length === 0 ? <div className="empty"><Clock3 size={28}/><b>فعلاً سفارشی آماده نیست</b><span>با آماده‌شدن سفارش فروشگاه، اینجا نمایش داده می‌شود.</span></div> : <div className="orders">{orders.map(order=><article className="order-card" key={order.id}>
        <div className="order-top"><div><span className="order-id">سفارش {order.id}</span><small><Clock3 size={13}/>{order.time}</small></div><span className={`badge ${order.status === 4 ? "done" : order.claimedByMe ? "mine" : "ready"}`}>{order.status === 4 ? "تکمیل‌شده" : order.claimedByMe ? "نزد شما" : "آمادهٔ دریافت"}</span></div>
        <div className="store-line"><Store size={16}/><b>{order.storeName}</b></div><div className="address"><MapPin size={17}/><div><b>{order.addressTitle}</b><span>{order.addressText}</span></div></div>
        <div className="items">{order.items.map(item=><span key={item.id}>{item.name} × {money(item.qty)}</span>)}</div>
        <div className="contact-row"><a href={`tel:${order.customerPhone}`}><Phone size={15}/> تماس با مشتری</a><b>{money(order.total)} تومان</b></div>
        {order.status === 3 && !order.claimedByMe && <button disabled={busy} className="primary action" onClick={()=>void mutateOrder(order,"claim")}><PackageCheck size={18}/> دریافت این سفارش</button>}
        {order.status === 3 && order.claimedByMe && <button disabled={busy} className="complete action" onClick={()=>void mutateOrder(order,"complete")}><CheckCircle2 size={18}/> ثبت تحویل به مشتری</button>}
        {order.status === 4 && <div className="completed"><CheckCircle2 size={16}/> تحویل نهایی ثبت شد</div>}
      </article>)}</div>}
    </>}
    <footer>وضعیت نهایی سفارش تنها پس از ورود پیک تأییدشده ثبت می‌شود.</footer>
  </main>;
}
