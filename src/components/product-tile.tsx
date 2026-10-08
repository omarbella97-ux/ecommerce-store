import Image from "next/image";
import Link from "next/link";
import { formatPrice, stockState, type Product } from "@/lib/products";

// Listing card used everywhere products appear in a grid-products row.
// Low and sold-out stock replace the tag in the eyebrow (data-stock styles it).
export function ProductTile({ product }: { product: Product }) {
  const state = stockState(product);
  const [image] = product.images;

  return (
    <Link
      href={`/products/${product.slug}`}
      className="product-tile h-full"
      data-stock={state === "in" ? undefined : state}
    >
      <p className="product-eyebrow">
        {state === "out" ? "Out of stock" : state === "low" ? "Low stock" : product.tag}
      </p>
      <div className="media-product" data-fit={product.imageFit}>
        {image ? (
          <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes="(min-width: 80rem) 25vw, (min-width: 48rem) 33vw, 50vw"
          />
        ) : (
          <div className="absolute inset-[18%] bg-surface-strong" />
        )}
      </div>
      <div className="product-meta">
        <h3>{product.name}</h3>
        <p>{formatPrice(product.price)}</p>
      </div>
    </Link>
  );
}
