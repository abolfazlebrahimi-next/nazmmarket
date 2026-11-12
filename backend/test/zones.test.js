import test from "node:test";
import assert from "node:assert/strict";
import {
  ZONE_CITIES,
  PLATFORM_CITY,
  resolveCity,
  isPlatformCity,
} from "../zones.js";

test("zone cities: only نظرآباد، آبیک، هشتگرد are in-zone", () => {
  assert.deepEqual([...ZONE_CITIES].sort(), ["آبیک", "نظرآباد", "هشتگرد"].sort());
});

test("resolveCity finds the zone city inside an address text", () => {
  assert.equal(resolveCity("گلستان، نظرآباد، خیابان امام، پلاک ۳"), "نظرآباد");
  assert.equal(resolveCity("آبیک، شهرک صنعتی"), "آبیک");
  assert.equal(resolveCity("هشتگرد جدید، بلوار اصلی"), "هشتگرد");
  assert.equal(resolveCity("کرج، خیابان گوهردشت"), null);
  assert.equal(resolveCity(""), null);
});

test("platform couriers serve only نظرآباد; Abyek/Hashtgerd stay seller-delivery", () => {
  assert.equal(PLATFORM_CITY, "نظرآباد");
  assert.equal(isPlatformCity("نظرآباد"), true);
  assert.equal(isPlatformCity("آبیک"), false);
  assert.equal(isPlatformCity("هشتگرد"), false);
  // شهر ناشناخته/خالی به سفیرهای پلتفرم می‌رسد (فقط شهرهای شناخته‌شدهٔ خارج از نظرآباد قفل می‌شوند)
  assert.equal(isPlatformCity(null), true);
  assert.equal(isPlatformCity(""), true);
  assert.equal(isPlatformCity("کرج"), false);
});
