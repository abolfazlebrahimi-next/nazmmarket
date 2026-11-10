import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Flame, Gift } from "lucide-react";
import type { ReactNode } from "react";

const PRODUCT_RAIL_PRELOAD_DISTANCE = "180px";
const SKELETON_CARD_COUNT = 6;

function ProductRailSkeleton() {
  return Array.from({ length: SKELETON_CARD_COUNT }, (_, index) => (
    <div className="market-product-skeleton" key={index} aria-hidden="true">
      <span className="skeleton-shimmer market-product-skeleton-image" />
      <span className="market-product-skeleton-copy">
        <span className="skeleton-shimmer market-product-skeleton-line" />
        <span className="skeleton-shimmer market-product-skeleton-line short" />
      </span>
      <span className="market-product-skeleton-prices">
        <span className="skeleton-shimmer market-product-skeleton-price" />
        <span className="skeleton-shimmer market-product-skeleton-old-price" />
      </span>
    </div>
  ));
}

export default function ProductRail({
  title,
  onAll,
  children,
  tone = "plain",
}: {
  title: string;
  onAll?: () => void;
  children: ReactNode;
  tone?: "plain" | "offer" | "deal" | "blue";
}) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [nearViewport, setNearViewport] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || nearViewport) return;
    if (!("IntersectionObserver" in window)) {
      setNearViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: `${PRODUCT_RAIL_PRELOAD_DISTANCE} 0px` },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [nearViewport]);

  return (
    <section
      ref={sectionRef}
      className={`market-shelf ${tone === "offer" ? "market-shelf-offer" : tone === "deal" ? "market-shelf-deals" : tone === "blue" ? "market-shelf-blue" : ""}`}
      aria-label={title}
    >
      <div className="market-shelf-heading">
        <div className="market-shelf-heading-copy">
          <h2>{title}</h2>
          {tone === "blue" && (
            <div className="market-shelf-gift-ribbon">
              <Gift size={16} strokeWidth={2} />
              <span>یه خنکیِ دوست‌داشتنی، برای حالِ بهتر!</span>
            </div>
          )}
          {tone === "deal" && (
            <div className="market-shelf-savings-ribbon">
              <Flame size={14} />
              <span>تخفیف واقعی · بیش از ۵٪</span>
            </div>
          )}
        </div>
        {onAll && (
          <button
            type="button"
            className="shelf-all"
            onClick={onAll}
            aria-label={`مشاهده همهٔ ${title}`}
          >
            <ArrowLeft size={20} />
          </button>
        )}
      </div>
      <div
        className="market-product-rail no-scrollbar"
        role="region"
        aria-label={`کالاهای ${title}`}
        aria-busy={nearViewport ? undefined : true}
        tabIndex={0}
      >
        {nearViewport ? children : <ProductRailSkeleton />}
      </div>
    </section>
  );
}
