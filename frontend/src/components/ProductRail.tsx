import { ArrowLeft, Gift } from "lucide-react";
import type { ReactNode } from "react";
export default function ProductRail({
  title,
  onAll,
  children,
  tone = "plain",
}: {
  title: string;
  onAll?: () => void;
  children: ReactNode;
  tone?: "plain" | "offer" | "blue";
}) {
  return (
    <section
      className={`market-shelf ${tone === "offer" ? "market-shelf-offer" : tone === "blue" ? "market-shelf-blue" : ""}`}
      aria-label={title}
    >
      <div className="market-shelf-heading">
        <div className="market-shelf-heading-copy">
          <h2>{title}</h2>
          {tone === "blue" && (
            <div className="market-shelf-gift-ribbon">
              <Gift size={15} strokeWidth={2.2} />
              <span>یه خنکیِ دوست‌داشتنی، برای حالِ بهتر!</span>
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
        tabIndex={0}
      >
        {children}
      </div>
    </section>
  );
}
