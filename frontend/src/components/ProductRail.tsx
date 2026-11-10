import { ArrowLeft } from "lucide-react";
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
  tone?: "plain" | "offer";
}) {
  return (
    <section
      className={`market-shelf ${tone === "offer" ? "market-shelf-offer" : ""}`}
      aria-label={title}
    >
      <div className="market-shelf-heading">
        <h2>{title}</h2>
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
