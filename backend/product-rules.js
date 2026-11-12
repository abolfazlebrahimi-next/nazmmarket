export function sellerPrice(base, percent, maximum) {
  if (
    !Number.isSafeInteger(base) ||
    base < 1 ||
    !Number.isInteger(percent) ||
    percent < 0 ||
    percent > maximum
  )
    throw Object.assign(
      new Error("قیمت یا درصد تخفیف از سقف مجاز معتبر نیست."),
      { status: 400, code: "invalid_price" },
    );
  return {
    price: Math.max(1, Math.round((base * (100 - percent)) / 100)),
    oldPrice: percent ? base : null,
  };
}
/**
 * «خرید اول» فروشگاهی: فروشنده چند کالا با درصد تخفیف (۲۵٪ به بالا) و حداقل
 * مبلغ سبد تعیین می‌کند. مشتری فقط یکی از آن کالاها را انتخاب می‌کند و فقط
 * «یک واحد» از همان کالا تخفیف می‌گیرد؛ مابقی سبد (کالاهای دیگر همان فروشگاه)
 * با قیمت عادی محاسبه می‌شود. تخفیف از همان لحظهٔ انتخاب اعمال می‌شود و حداقل
 * مبلغ سبد، شرط «تکمیل خرید» است: تا سبد به آن نرسد سفارش ثبت نمی‌شود.
 *
 * `offer` = { percent, minBasket } از ردیفِ فعالِ `store_first_offers` همان
 * فروشگاه. خروجی، مبلغ تخفیفِ «یک واحد» است.
 */
export function firstOffer(items, productId, used, offer) {
  if (productId == null) return 0;
  if (used)
    throw Object.assign(new Error("پیشنهاد خرید اول قبلاً استفاده شده است."), {
      status: 409,
      code: "first_offer_used",
    });
  const percent = Number(offer?.percent ?? 0);
  if (!Number.isFinite(percent) || percent < 25 || percent > 100)
    throw Object.assign(
      new Error("پیشنهاد خرید اول برای این کالا فعال نیست."),
      { status: 400, code: "first_offer_invalid" },
    );
  const item = items.find((i) => i.id === productId && i.qty >= 1);
  if (!item)
    throw Object.assign(
      new Error("کالای پیشنهاد خرید اول باید داخل سبد باشد."),
      { status: 400, code: "first_offer_invalid" },
    );
  // قیمت تخفیف‌دار از همان اول اعمال می‌شود؛ اما تا سبد به حداقلِ تعیین‌شدهٔ
  // فروشنده نرسد، «خرید اول» تکمیل نمی‌شود و سفارش ثبت نمی‌گردد.
  const subtotal = items.reduce((sum, i) => sum + Number(i.price) * Number(i.qty), 0);
  const minBasket = Number(offer?.minBasket ?? 0);
  if (subtotal < minBasket)
    throw Object.assign(
      new Error(
        `برای تکمیل «خرید اول» باید مبلغ سبد خرید به ${minBasket.toLocaleString("fa-IR")} تومان برسد.`,
      ),
      { status: 400, code: "minimum_basket" },
    );
  // فقط یک واحد از همان کالا تخفیف دارد؛ واحدهای بعدی عادی‌اند.
  item.discountedQty = 1;
  item.unitDiscount = Math.floor((Number(item.price) * percent) / 100);
  return item.unitDiscount;
}
