import Image from "next/image";
import Link from "next/link";
import { ProductTile } from "@/components/product-tile";
import { getNewArrivals } from "@/lib/products";

// Temporary stock photography from Unsplash (Unsplash License).
const hero = {
  src: "https://images.unsplash.com/photo-1788621795557-9c1c9b8e643d",
  alt: "Figure in a tailored black suit walking across a dark, empty floor",
};

const stories = [
  {
    title: "Women's collection",
    cta: "Shop women",
    src: "https://images.unsplash.com/photo-1767609127923-14192f306af8",
    alt: "Woman in a tailored blazer and tie on a rooftop",
  },
  {
    title: "Men's collection",
    cta: "Shop men",
    src: "https://images.unsplash.com/photo-1618886614638-80e3c103d31a",
    alt: "Man in a black suit standing on a city square",
  },
];

export default async function Home() {
  const newIn = await getNewArrivals({ limit: 4 });

  return (
    <main>
      {/* Hero — full-bleed, header floats over it. */}
      <section className="media-hero bg-ink">
        <Image
          src={hero.src}
          alt={hero.alt}
          fill
          preload
          sizes="100vw"
          // The figure sits right of centre; keep it in the narrow mobile crop.
          className="object-[85%_50%] md:object-center"
        />
        <div className="scrim absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-6 px-gutter pb-12 text-center text-white md:pb-16">
          <h1 className="display text-display-lg">The autumn edit</h1>
          <a href="#" className="btn btn-inverse">
            Discover the collection
          </a>
        </div>
      </section>

      {/* Product row */}
      <section className="pt-12 md:pt-16">
        <div className="mb-6 flex flex-col items-center gap-2 px-gutter text-center">
          <h2 className="heading">New this week</h2>
          <Link href="/new-arrivals" className="link-cta">
            Shop all
          </Link>
        </div>
        <ul className="grid-products">
          {newIn.map((product) => (
            <li key={product.slug}>
              <ProductTile product={product} />
            </li>
          ))}
        </ul>
      </section>

      {/* Editorial pair */}
      <section className="grid-split mt-12 md:mt-16">
        {stories.map((story) => (
          <a key={story.title} href="#" className="media-editorial group">
            <Image
              src={story.src}
              alt={story.alt}
              fill
              sizes="(min-width: 48rem) 50vw, 100vw"
            />
            <div className="scrim absolute inset-0" />
            <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 p-8 text-center text-white">
              <h2 className="heading">{story.title}</h2>
              <span className="link-cta">{story.cta}</span>
            </div>
          </a>
        ))}
      </section>

      {/* Statement */}
      <section className="section container-prose flex flex-col items-center gap-6 text-center">
        <p className="label text-muted">The house</p>
        <p className="display text-display-sm">
          Pieces made to be carried for years, finished by hand and repaired
          for life.
        </p>
        <a href="#" className="btn btn-secondary">
          Our craft
        </a>
      </section>
    </main>
  );
}
