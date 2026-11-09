import { useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import {
  ArrowDownLeft, ArrowLeft, BadgePercent, Banknote, Bell, Boxes, Building2, Camera,
  Check, ChevronDown, CircleHelp, Clock3, FileImage, ImagePlus, LayoutDashboard,
  LogOut, MapPin, Menu, PackagePlus, Plus, Search, ShieldCheck,
  ShoppingBag, Store, TicketPercent, UserRound, Wallet, X,
} from "lucide-react";

type Page = "overview" | "orders" | "products" | "discounts" | "store" | "account";
type Product = { id: number; name: string; category: string; price: number; stock: number; image: string; active: boolean };
type Promo = { id: number; code: string; title: string; kind: string; amount: number; ends: string };
type SellerProfile = { name: string; phone: string; shopName: string; category: string; address: string; lat: string; lng: string; photo: string; logo: string };

const navItems: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "نمای کلی", icon: LayoutDashboard },
  { id: "orders", label: "سفارش‌ها", icon: ShoppingBag },
  { id: "products", label: "محصولات", icon: Boxes },
  { id: "discounts", label: "کدهای تخفیف", icon: TicketPercent },
  { id: "store", label: "اطلاعات فروشگاه", icon: Store },
  { id: "account", label: "حساب و تسویه", icon: UserRound },
];
const money = (n: number) => new Intl.NumberFormat("fa-IR").format(n);
const emptyProfile: SellerProfile = { name: "", phone: "", shopName: "", category: "", address: "", lat: "", lng: "", photo: "", logo: "" };

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span className="field-label">{label}</span>{children}{hint && <small className="field-hint">{hint}</small>}</label>;
}
function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) { return <input {...props} className={`input ${props.className ?? ""}`} />; }
function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) { return <select {...props} className={`input ${props.className ?? ""}`} />; }
function PhotoPicker({ label, image, onChange, square = false }: { label: string; image: string; onChange: (url: string) => void; square?: boolean }) {
  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith("image/")) onChange(URL.createObjectURL(file));
  };
  return <label className={`photo-picker ${square ? "photo-square" : ""} ${image ? "has-photo" : ""}`}>
    <input type="file" accept="image/*" onChange={onFile} />
    {image ? <img src={image} alt={label} /> : <><ImagePlus size={22} /><span>{label}</span><small>فقط عکس واقعی فروشگاه خودتان</small></>}
    {image && <span className="photo-edit"><Camera size={15} /> تغییر عکس</span>}
  </label>;
}

export default function SellerApp() {
  const [page, setPage] = useState<Page>("overview");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [preview, setPreview] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [notice, setNotice] = useState("");
  const [profile, setProfile] = useState<SellerProfile>(emptyProfile);
  const [products, setProducts] = useState<Product[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [addProduct, setAddProduct] = useState(false);
  const [addPromo, setAddPromo] = useState(false);
  const [query, setQuery] = useState("");
  const [productForm, setProductForm] = useState({ name: "", category: "لبنیات", price: "", stock: "", image: "" });
  const [promoForm, setPromoForm] = useState({ code: "", title: "", kind: "درصدی", amount: "", ends: "" });
  const shownProducts = useMemo(() => products.filter((p) => p.name.includes(query.trim())), [products, query]);

  const toast = (text: string) => { setNotice(text); window.setTimeout(() => setNotice(""), 3800); };
  const setProfileField = (key: keyof SellerProfile, value: string) => setProfile((old) => ({ ...old, [key]: value }));
  const goTo = (target: Page) => { setPage(target); setMobileNav(false); };
  const enterPreview = () => { setPreview(true); setPage("overview"); toast("حالت پیش‌نمایش فعال شد؛ تغییرات فقط تا زمان تازه‌سازی صفحه می‌مانند."); };

  const submitLogin = (event: FormEvent) => { event.preventDefault(); toast("ورود واقعی هنوز به API فروشندگان وصل نشده است. برای مشاهدهٔ رابط از پیش‌نمایش استفاده کنید."); };
  const submitRegister = (event: FormEvent) => { event.preventDefault(); toast("اطلاعات ارسال نشد؛ ثبت‌نام امن فروشنده پس از آماده‌شدن API فعال می‌شود."); };
  const submitProduct = (event: FormEvent) => {
    event.preventDefault();
    setProducts((old) => [...old, { id: Date.now(), name: productForm.name.trim(), category: productForm.category, price: Number(productForm.price), stock: Number(productForm.stock), image: productForm.image, active: true }]);
    setProductForm({ name: "", category: "لبنیات", price: "", stock: "", image: "" });
    setAddProduct(false); toast("محصول به پیش‌نمایش اضافه شد؛ هنوز روی سرور ذخیره نشده است.");
  };
  const submitPromo = (event: FormEvent) => {
    event.preventDefault();
    setPromos((old) => [...old, { id: Date.now(), code: promoForm.code.trim().toUpperCase(), title: promoForm.title.trim(), kind: promoForm.kind, amount: Number(promoForm.amount), ends: promoForm.ends }]);
    setPromoForm({ code: "", title: "", kind: "درصدی", amount: "", ends: "" });
    setAddPromo(false); toast("کد تخفیف به پیش‌نمایش اضافه شد؛ هنوز منتشر نشده است.");
  };
  const captureLocation = () => {
    if (!navigator.geolocation) return toast("مرورگر امکان دریافت موقعیت را ندارد.");
    navigator.geolocation.getCurrentPosition((p) => setProfile((old) => ({ ...old, lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) })), () => toast("دسترسی موقعیت داده نشد؛ نشانی را دستی وارد کنید."), { enableHighAccuracy: true });
  };

  if (!preview) return <AuthScreen mode={authMode} setMode={setAuthMode} onLogin={submitLogin} onRegister={submitRegister} onPreview={enterPreview} profile={profile} setProfile={setProfile} />;

  const activeItem = navItems.find((item) => item.id === page) ?? navItems[0];
  return <div className="app-shell" dir="rtl">
    <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
      <div className="brand-lockup"><span className="brand-mark"><Store size={20} /></span><span><strong>ناز مارکت</strong><small>پنل فروشندگان</small></span><button className="mobile-close icon-button" onClick={() => setMobileNav(false)} aria-label="بستن منو"><X size={18} /></button></div>
      <div className="seller-chip"><span className="avatar">{profile.shopName ? profile.shopName.slice(0, 1) : "ف"}</span><span className="seller-chip-text"><strong>{profile.shopName || "فروشگاه شما"}</strong><small>حساب پیش‌نمایش</small></span><ChevronDown size={15} /></div>
      <div className="nav-caption">مدیریت فروشگاه</div>
      <nav className="side-nav">{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-link ${page === id ? "active" : ""}`} onClick={() => goTo(id)}><Icon size={18} /><span>{label}</span>{id === "orders" && <span className="nav-count">۰</span>}</button>)}</nav>
      <div className="side-bottom"><div className="support-card"><span className="support-icon"><CircleHelp size={17} /></span><strong>نیاز به راهنمایی دارید؟</strong><small>پشتیبانی فروشندگان</small><button onClick={() => toast("راه ارتباطی پشتیبانی پس از آماده‌شدن سرویس فروشندگان نمایش داده می‌شود.")}>تماس با پشتیبانی <ArrowLeft size={13} /></button></div><button className="nav-link logout" onClick={() => { setPreview(false); setAuthMode("login"); }}><LogOut size={17} /><span>خروج از پیش‌نمایش</span></button></div>
    </aside>
    {mobileNav && <button className="scrim" onClick={() => setMobileNav(false)} aria-label="بستن منو" />}
    <main className="main-area">
      <header className="topbar"><div className="topbar-start"><button className="mobile-menu icon-button" onClick={() => setMobileNav(true)} aria-label="باز کردن منو"><Menu size={20} /></button><div className="crumb"><span>پنل فروشنده</span><ArrowLeft size={14} /><strong>{activeItem.label}</strong></div></div><div className="topbar-actions"><span className="preview-pill"><span /> پیش‌نمایش</span><button className="icon-button notification" aria-label="اعلان‌ها" onClick={() => toast("فعلاً اعلان جدیدی ندارید.")}><Bell size={18} /><i /></button><span className="top-avatar">{profile.name ? profile.name.slice(0, 1) : "ف"}</span></div></header>
      <div className="page-wrap">
        <div className="demo-warning"><ShieldCheck size={18} /><div><strong>نسخهٔ پیش‌نمایش رابط فروشندگان</strong><span>اطلاعات هویتی و بانکی واقعی وارد نکنید؛ فعلاً به سرور متصل نیست و با تازه‌سازی پاک می‌شود.</span></div><button onClick={() => setPreview(false)} aria-label="خروج"><X size={17} /></button></div>
        {page === "overview" && <Overview profile={profile} products={products} promos={promos} goTo={goTo} />}
        {page === "orders" && <OrdersPage />}
        {page === "products" && <ProductsPage products={shownProducts} query={query} setQuery={setQuery} onAdd={() => setAddProduct(true)} onToggle={(id) => setProducts((old) => old.map((p) => p.id === id ? { ...p, active: !p.active } : p))} />}
        {page === "discounts" && <DiscountsPage promos={promos} onAdd={() => setAddPromo(true)} onDelete={(id) => setPromos((old) => old.filter((p) => p.id !== id))} />}
        {page === "store" && <StorePage profile={profile} setProfile={setProfileField} onLocation={captureLocation} onSave={() => toast("پروفایل فقط در پیش‌نمایش تغییر کرد و روی سرور ثبت نشد.")} />}
        {page === "account" && <AccountPage profile={profile} setProfile={setProfileField} />}
        <footer className="page-footer"><span>ناز مارکت · پنل فروشندگان</span><span>نسخهٔ پیش‌نمایش · ۱۴۰۵</span></footer>
      </div>
    </main>
    {addProduct && <Modal title="افزودن محصول جدید" subtitle="اطلاعات و تصویر واقعی محصول فروشگاه را وارد کنید." onClose={() => setAddProduct(false)}><form className="modal-form" onSubmit={submitProduct}>
      <PhotoPicker label="انتخاب عکس محصول" image={productForm.image} square onChange={(image) => setProductForm((f) => ({ ...f, image }))} />
      <Field label="نام محصول"><TextInput required maxLength={100} placeholder="مثلاً شیر پرچرب ۱ لیتری" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} /></Field>
      <div className="form-grid"><Field label="دسته‌بندی"><SelectInput value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}>{["لبنیات", "میوه و سبزی", "نوشیدنی", "تنقلات", "مواد غذایی", "بهداشت و شوینده", "سایر"].map((x) => <option key={x}>{x}</option>)}</SelectInput></Field><Field label="قیمت (تومان)"><TextInput required type="number" min="1" placeholder="۰" value={productForm.price} onChange={(e) => setProductForm({ ...productForm, price: e.target.value })} /></Field><Field label="موجودی"><TextInput required type="number" min="0" placeholder="۰" value={productForm.stock} onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })} /></Field></div>
      <div className="modal-actions"><button type="button" className="btn secondary" onClick={() => setAddProduct(false)}>انصراف</button><button type="submit" className="btn primary"><Plus size={16} /> افزودن به پیش‌نمایش</button></div>
    </form></Modal>}
    {addPromo && <Modal title="ساخت کد تخفیف" subtitle="کدهای این نسخه فقط برای نمایش در همین مرورگر هستند." onClose={() => setAddPromo(false)}><form className="modal-form" onSubmit={submitPromo}>
      <Field label="عنوان تخفیف"><TextInput required maxLength={80} placeholder="مثلاً تخفیف خرید اول" value={promoForm.title} onChange={(e) => setPromoForm({ ...promoForm, title: e.target.value })} /></Field>
      <Field label="کد تخفیف"><TextInput required maxLength={24} dir="ltr" placeholder="NAZ20" value={promoForm.code} onChange={(e) => setPromoForm({ ...promoForm, code: e.target.value.toUpperCase() })} /></Field>
      <div className="form-grid"><Field label="نوع تخفیف"><SelectInput value={promoForm.kind} onChange={(e) => setPromoForm({ ...promoForm, kind: e.target.value })}><option>درصدی</option><option>مبلغ ثابت (تومان)</option></SelectInput></Field><Field label={promoForm.kind === "درصدی" ? "درصد" : "مبلغ (تومان)"}><TextInput required type="number" min="1" max={promoForm.kind === "درصدی" ? 100 : undefined} value={promoForm.amount} onChange={(e) => setPromoForm({ ...promoForm, amount: e.target.value })} /></Field></div>
      <Field label="تاریخ پایان"><TextInput required type="date" value={promoForm.ends} onChange={(e) => setPromoForm({ ...promoForm, ends: e.target.value })} /></Field>
      <div className="modal-actions"><button type="button" className="btn secondary" onClick={() => setAddPromo(false)}>انصراف</button><button type="submit" className="btn primary"><BadgePercent size={16} /> ساخت در پیش‌نمایش</button></div>
    </form></Modal>}
    {notice && <div className="toast" role="status"><Check size={17} />{notice}</div>}
  </div>;
}

function AuthScreen({ mode, setMode, onLogin, onRegister, onPreview, profile, setProfile }: { mode: "login" | "register"; setMode: (m: "login" | "register") => void; onLogin: (e: FormEvent) => void; onRegister: (e: FormEvent) => void; onPreview: () => void; profile: SellerProfile; setProfile: (p: SellerProfile) => void }) {
  const [form, setForm] = useState({ phone: "", password: "", nationalId: "", iban: "" });
  const [photo, setPhoto] = useState("");
  return <div className="auth-screen" dir="rtl">
    <div className="auth-brand"><span className="brand-mark"><Store size={20} /></span><div><strong>ناز مارکت</strong><small>مرکز فروشندگان</small></div><span className="auth-help"><CircleHelp size={15} /> راهنمای فروشندگان</span></div>
    <div className="auth-layout"><section className="auth-hero"><span className="eyebrow"><span /> همراه رشد کسب‌وکارهای محلی</span><h1>فروشگاهت را<br /><em>آنلاین و نزدیک</em> کن.</h1><p>مدیریت محصولات و سفارش‌های فروشگاهت در یک پنل ساده؛ شروع همکاری با ناز مارکت از اینجا است.</p><div className="hero-points"><span><Check size={15} /> مدیریت موجودی و قیمت</span><span><Check size={15} /> ساخت کمپین تخفیف</span><span><Check size={15} /> ثبت فروشگاه و نشانی دقیق</span></div><div className="hero-note"><ShieldCheck size={17} /><span>اطلاعات هویتی و بانکی فقط از مسیر امن سرور ثبت خواهد شد.</span></div></section>
      <section className="auth-card"><div className="auth-tabs"><button className={mode === "login" ? "selected" : ""} onClick={() => setMode("login")}>ورود فروشندگان</button><button className={mode === "register" ? "selected" : ""} onClick={() => setMode("register")}>ثبت فروشگاه</button></div>
        {mode === "login" ? <form onSubmit={onLogin} className="auth-form"><div><h2>خوش برگشتی</h2><p>برای ورود، شماره موبایل و رمز عبورت را وارد کن.</p></div><Field label="شماره موبایل"><TextInput type="tel" inputMode="numeric" dir="ltr" required placeholder="09xxxxxxxxx" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field><Field label="رمز عبور"><TextInput type="password" required placeholder="رمز عبور حساب فروشندگی" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field><button type="submit" className="btn primary full">ورود به پنل <ArrowLeft size={16} /></button><button type="button" className="text-action" onClick={() => setMode("register")}>هنوز فروشنده نیستی؟ درخواست همکاری بده</button><div className="auth-divider"><span>یا</span></div><button type="button" className="btn secondary full" onClick={onPreview}>مشاهدهٔ پیش‌نمایش پنل</button></form> : <form onSubmit={onRegister} className="auth-form register-form"><div><h2>درخواست همکاری فروشگاه</h2><p>فرم نمایشی است؛ اطلاعات واقعی را فعلاً وارد نکنید.</p></div><div className="form-grid"><Field label="نام و نام خانوادگی"><TextInput required autoComplete="name" placeholder="نام صاحب امتیاز" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></Field><Field label="نام فروشگاه"><TextInput required placeholder="نام روی تابلو فروشگاه" value={profile.shopName} onChange={(e) => setProfile({ ...profile, shopName: e.target.value })} /></Field></div><div className="form-grid"><Field label="شماره موبایل"><TextInput required dir="ltr" inputMode="numeric" pattern="09[0-9]{9}" maxLength={11} placeholder="09xxxxxxxxx" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></Field><Field label="کد ملی"><TextInput required dir="ltr" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} placeholder="۱۰ رقم" value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} /></Field></div><Field label="شماره شبا"><TextInput required dir="ltr" pattern="IR[0-9]{24}" maxLength={26} placeholder="IRxxxxxxxxxxxxxxxxxxxxxxxx" value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value.toUpperCase() })} /></Field><Field label="رمز عبور حساب"><TextInput required type="password" minLength={8} autoComplete="new-password" placeholder="حداقل ۸ نویسه" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field><Field label="نشانی دقیق فروشگاه"><TextInput required placeholder="استان، شهر، خیابان، پلاک" value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} /></Field><div className="form-grid"><PhotoPicker label="عکس واقعی فروشگاه" image={photo} onChange={setPhoto} /><Field label="زمینهٔ فعالیت"><SelectInput value={profile.category} onChange={(e) => setProfile({ ...profile, category: e.target.value })}><option value="">انتخاب کنید</option><option>سوپرمارکت</option><option>میوه و سبزی</option><option>نانوایی و قنادی</option><option>سایر</option></SelectInput></Field></div><button type="submit" className="btn primary full">ثبت درخواست همکاری <ArrowLeft size={16} /></button><button type="button" className="text-action" onClick={() => setMode("login")}>قبلاً ثبت‌نام کرده‌ای؟ ورود</button></form>}
        <p className="auth-safe"><ShieldCheck size={14} /> این نسخه نمایشی است و اطلاعات واردشده ارسال یا ذخیره نمی‌شود.</p>
      </section></div><footer className="auth-footer"><span>© ناز مارکت</span><span>ویژهٔ صاحبان فروشگاه</span></footer>
  </div>;
}

function Overview({ profile, products, promos, goTo }: { profile: SellerProfile; products: Product[]; promos: Promo[]; goTo: (p: Page) => void }) {
  return <><div className="welcome-row"><div><span className="eyebrow">داشبورد فروشنده</span><h1>سلام{profile.name ? `، ${profile.name}` : "، به پنل فروشندگان خوش آمدید"} 👋</h1><p>اینجا می‌توانید وضعیت فروشگاه و کارهای روزانه را ببینید.</p></div><button className="btn primary" onClick={() => goTo("products")}><PackagePlus size={17} /> افزودن محصول</button></div>
    <div className="status-banner"><span className="status-icon"><Clock3 size={20} /></span><div><strong>فروشگاه هنوز برای بررسی ارسال نشده</strong><p>برای شروع، اطلاعات فروشگاه را تکمیل کنید. تأیید نهایی و فعال‌سازی فروش نیازمند بررسی تیم ناز مارکت است.</p></div><button className="btn secondary small" onClick={() => goTo("store")}>تکمیل اطلاعات <ArrowLeft size={14} /></button></div>
    <div className="stats-grid"><Stat icon={ShoppingBag} label="سفارش امروز" value="۰" note="هنوز سفارشی ثبت نشده" tone="green" /><Stat icon={Banknote} label="فروش امروز" value="۰ تومان" note="پس از اتصال فروشگاه نمایش داده می‌شود" tone="orange" /><Stat icon={Boxes} label="محصولات فعال" value={money(products.filter((p) => p.active).length)} note="محصولات پیش‌نمایش" tone="blue" /><Stat icon={BadgePercent} label="تخفیف‌های فعال" value={money(promos.length)} note="کدهای آزمایشی این نشست" tone="violet" /></div>
    <div className="content-grid"><section className="panel"><div className="panel-head"><div><h2>آخرین سفارش‌ها</h2><p>سفارش‌های جدید فروشگاه اینجا نمایش داده می‌شوند.</p></div><button className="link-button" onClick={() => goTo("orders")}>همه سفارش‌ها <ArrowLeft size={14} /></button></div><EmptyState icon={ShoppingBag} title="هنوز سفارشی ندارید" text="پس از تأیید فروشگاه و شروع فعالیت، سفارش‌های مشتریان اینجا نمایش داده می‌شود." /></section><section className="panel quick-panel"><div className="panel-head"><div><h2>شروع سریع</h2><p>فروشگاهت را برای شروع آماده کن.</p></div></div><QuickAction icon={Building2} title="تکمیل پروفایل فروشگاه" text="نشانی، تصویر و ساعات کاری" onClick={() => goTo("store")} /><QuickAction icon={PackagePlus} title="ثبت اولین محصول" text="قیمت، موجودی و تصویر واقعی" onClick={() => goTo("products")} /><QuickAction icon={TicketPercent} title="ساخت کد تخفیف" text="تعریف کمپین برای مشتریان" onClick={() => goTo("discounts")} /></section></div>
    <div className="real-photo-note"><FileImage size={19} /><div><strong>عکس‌های واقعی فروشگاه و کالا</strong><span>برای ثبت تصویر، از عکس واقعی و متعلق به فروشگاه یا محصول خودتان استفاده کنید. این پنل تصویر نمونه یا فروشگاه ساختگی نمایش نمی‌دهد.</span></div></div>
  </>;
}
function Stat({ icon: Icon, label, value, note, tone }: { icon: typeof ShoppingBag; label: string; value: string; note: string; tone: string }) { return <div className="stat-card"><span className={`stat-icon ${tone}`}><Icon size={19} /></span><span className="stat-label">{label}</span><strong>{value}</strong><small>{note}</small></div>; }
function QuickAction({ icon: Icon, title, text, onClick }: { icon: typeof Building2; title: string; text: string; onClick: () => void }) { return <button className="quick-action" onClick={onClick}><span><Icon size={17} /></span><div><strong>{title}</strong><small>{text}</small></div><ArrowDownLeft size={15} /></button>; }
function EmptyState({ icon: Icon, title, text }: { icon: typeof ShoppingBag; title: string; text: string }) { return <div className="empty-state"><span><Icon size={25} /></span><strong>{title}</strong><p>{text}</p></div>; }

function OrdersPage() { return <PageHeading title="سفارش‌ها" subtitle="سفارش‌های فروشگاه و وضعیت آماده‌سازی را مدیریت کنید."><div className="filter-row"><button className="filter active">همه <span>۰</span></button><button className="filter">در انتظار تأیید</button><button className="filter">در حال آماده‌سازی</button><button className="filter">تکمیل‌شده</button></div><section className="panel"><EmptyState icon={ShoppingBag} title="سفارشی برای نمایش وجود ندارد" text="سفارش واقعی پس از فعال‌شدن فروشگاه در این فهرست قرار می‌گیرد." /></section></PageHeading>; }
function ProductsPage({ products, query, setQuery, onAdd, onToggle }: { products: Product[]; query: string; setQuery: (q: string) => void; onAdd: () => void; onToggle: (id: number) => void }) { return <PageHeading title="محصولات فروشگاه" subtitle="فهرست کالاها، موجودی و قیمت‌های فروشگاه را مدیریت کنید."><div className="toolbar"><div className="search-box"><Search size={17} /><input placeholder="جست‌وجوی نام محصول" value={query} onChange={(e) => setQuery(e.target.value)} /></div><button className="btn primary" onClick={onAdd}><Plus size={17} /> محصول جدید</button></div>{products.length === 0 ? <section className="panel"><EmptyState icon={Boxes} title={query ? "محصولی پیدا نشد" : "هنوز محصولی ثبت نشده"} text={query ? "عبارت دیگری را جست‌وجو کنید." : "محصول واقعی فروشگاه را با عکس، قیمت و موجودی اضافه کنید."} /></section> : <div className="product-grid">{products.map((p) => <article className="product-card" key={p.id}><div className="product-image">{p.image ? <img src={p.image} alt={p.name} /> : <span><ImagePlus size={24} /></span>}<button className={`toggle ${p.active ? "on" : ""}`} onClick={() => onToggle(p.id)} aria-label="تغییر وضعیت"><i /></button></div><div className="product-info"><small>{p.category}</small><h3>{p.name}</h3><div className="product-meta"><strong>{money(p.price)} <small>تومان</small></strong><span>موجودی: {money(p.stock)}</span></div></div></article>)}</div>}</PageHeading>; }
function DiscountsPage({ promos, onAdd, onDelete }: { promos: Promo[]; onAdd: () => void; onDelete: (id: number) => void }) { return <PageHeading title="کدهای تخفیف" subtitle="برای افزایش خرید، کدهای تخفیف و کمپین بسازید."><div className="toolbar"><div className="toolbar-note"><TicketPercent size={17} /> تخفیف‌ها پس از اتصال به سرویس فروشندگان قابل انتشار خواهند بود.</div><button className="btn primary" onClick={onAdd}><Plus size={17} /> ساخت کد تخفیف</button></div>{promos.length === 0 ? <section className="panel"><EmptyState icon={BadgePercent} title="کد تخفیفی ندارید" text="در این نسخه هیچ کد واقعی از قبل تعریف نشده است." /></section> : <section className="panel promo-list">{promos.map((p) => <div className="promo-row" key={p.id}><span className="promo-icon"><TicketPercent size={19} /></span><div className="promo-desc"><strong>{p.title}</strong><small dir="ltr">{p.code} · {p.kind === "درصدی" ? `${p.amount}٪` : `${money(p.amount)} تومان`}</small></div><span className="promo-date">تا {p.ends}</span><button className="delete-button" onClick={() => onDelete(p.id)}>حذف</button></div>)}</section>}</PageHeading>; }
function PageHeading({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) { return <><div className="page-title"><div><h1>{title}</h1><p>{subtitle}</p></div></div>{children}</>; }

function StorePage({ profile, setProfile, onLocation, onSave }: { profile: SellerProfile; setProfile: (k: keyof SellerProfile, v: string) => void; onLocation: () => void; onSave: () => void }) { return <PageHeading title="اطلاعات فروشگاه" subtitle="اطلاعات عمومی و نشانی دقیق فروشگاه خود را تکمیل کنید."><div className="store-layout"><section className="panel form-panel"><div className="panel-head"><div><h2>پروفایل فروشگاه</h2><p>در نسخهٔ نهایی اطلاعات پس از بررسی تیم نمایش داده می‌شود.</p></div><span className="draft-pill">پیش‌نویس</span></div><div className="store-photo-row"><PhotoPicker label="افزودن عکس واقعی مغازه" image={profile.photo} onChange={(v) => setProfile("photo", v)} /><PhotoPicker label="لوگو یا تصویر برند" image={profile.logo} onChange={(v) => setProfile("logo", v)} square /></div><div className="form-grid"><Field label="نام فروشگاه"><TextInput placeholder="نام روی تابلو" value={profile.shopName} onChange={(e) => setProfile("shopName", e.target.value)} /></Field><Field label="دسته‌بندی"><SelectInput value={profile.category} onChange={(e) => setProfile("category", e.target.value)}><option value="">انتخاب دسته‌بندی</option><option>سوپرمارکت</option><option>میوه و سبزی</option><option>نانوایی و قنادی</option><option>سایر</option></SelectInput></Field></div><Field label="نشانی دقیق فروشگاه"><textarea className="input textarea" rows={3} placeholder="استان، شهر، خیابان، کوچه، پلاک و واحد" value={profile.address} onChange={(e) => setProfile("address", e.target.value)} /></Field><div className="location-box"><div className="location-icon"><MapPin size={18} /></div><div className="location-copy"><strong>موقعیت جغرافیایی فروشگاه</strong><small>{profile.lat && profile.lng ? `عرض ${profile.lat} · طول ${profile.lng}` : "برای ثبت موقعیت فعلی اجازهٔ مرورگر لازم است."}</small></div><button type="button" className="btn secondary small" onClick={onLocation}><MapPin size={15} /> ثبت موقعیت فعلی</button></div><Field label="ساعات کاری"><TextInput placeholder="مثلاً هر روز ۸ تا ۲۲" /></Field><button className="btn primary" onClick={onSave}><Check size={16} /> ذخیرهٔ پیش‌نمایش</button></section><aside className="panel checklist"><h3>برای شروع همکاری آماده شوید</h3><Checklist label="تکمیل مشخصات صاحب فروشگاه" done={!!profile.name} /><Checklist label="ثبت شماره تماس و کد ملی" done={!!profile.phone} /><Checklist label="ثبت نشانی دقیق فروشگاه" done={!!profile.address} /><Checklist label="بارگذاری تصویر واقعی فروشگاه" done={!!profile.photo} /><div className="checklist-note"><ShieldCheck size={16} /> مدارک هویتی و مجوزها باید فقط از مسیر امن و مورد تأیید ارسال شوند.</div></aside></div></PageHeading>; }
function Checklist({ label, done }: { label: string; done: boolean }) { return <div className={`check-row ${done ? "done" : ""}`}><span>{done ? <Check size={13} /> : <span />}</span>{label}</div>; }
function AccountPage({ profile, setProfile }: { profile: SellerProfile; setProfile: (k: keyof SellerProfile, v: string) => void }) { return <PageHeading title="حساب و تسویه" subtitle="اطلاعات صاحب امتیاز، راه‌های ارتباطی و حساب بانکی فروشگاه."><section className="panel form-panel account-panel"><div className="panel-head"><div><h2>اطلاعات صاحب فروشگاه</h2><p>برای امنیت، اطلاعات واقعی را در این نسخهٔ پیش‌نمایش وارد نکنید.</p></div><span className="secure-label"><ShieldCheck size={14} /> بخش حساس</span></div><div className="form-grid"><Field label="نام و نام خانوادگی"><TextInput placeholder="نام صاحب امتیاز" value={profile.name} onChange={(e) => setProfile("name", e.target.value)} /></Field><Field label="شماره موبایل"><TextInput dir="ltr" inputMode="numeric" placeholder="09xxxxxxxxx" value={profile.phone} onChange={(e) => setProfile("phone", e.target.value)} /></Field><Field label="کد ملی"><TextInput dir="ltr" inputMode="numeric" maxLength={10} placeholder="پس از اتصال امن سرور" disabled /></Field><Field label="شماره شبا"><TextInput dir="ltr" placeholder="IR ـ پس از اتصال امن سرور" disabled /></Field></div><div className="notice-inline"><ShieldCheck size={17} /><span>کد ملی، شبا و مدارک در این نسخه قابل ارسال یا ذخیره نیستند. این اطلاعات باید پس از پیاده‌سازی API امن ثبت شوند.</span></div><div className="settlement-card"><span><Wallet size={20} /></span><div><strong>وضعیت تسویه</strong><small>پس از تأیید فروشگاه و اتصال حساب بانکی فعال می‌شود.</small></div><span className="pending-pill">در انتظار ثبت</span></div><button className="btn secondary" onClick={() => setProfile("name", profile.name)}>ذخیرهٔ پیش‌نمایش</button></section></PageHeading>; }

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: ReactNode }) { return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><header className="modal-head"><div><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-button" onClick={onClose} aria-label="بستن"><X size={19} /></button></header>{children}</section></div>; }
