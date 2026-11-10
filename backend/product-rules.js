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
export function firstOffer(items, productId, used) {
  if (productId == null) return 0;
  if (used)
    throw Object.assign(new Error("پیشنهاد خرید اول قبلاً استفاده شده است."), {
      status: 409,
      code: "first_offer_used",
    });
  const item = items.find(
    (i) => i.id === productId && i.category === "drinks" && i.qty >= 1,
  );
  if (!item)
    throw Object.assign(
      new Error("پیشنهاد خرید اول فقط برای یک واحد نوشیدنی داخل سبد است."),
      { status: 400, code: "first_offer_invalid" },
    );
  item.discountedQty = 1;
  item.unitDiscount = Math.floor(item.price / 2);
  return item.unitDiscount;
}
