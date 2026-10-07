// Placeholder catalogue loaded by `pnpm db:seed`. Prices are whole QAR here;
// the seed converts them to minor units for the `products.price` column.

import type { ProductImageData } from "./schema";

// Temporary stock photography from Unsplash (Unsplash License).
const unsplash = (id: string) => `https://images.unsplash.com/${id}`;

export const seedCategories = [
  { slug: "handbags", name: "Handbags" },
  { slug: "shoes", name: "Shoes" },
  { slug: "accessories", name: "Accessories" },
];

export type SeedProduct = {
  slug: string;
  name: string;
  categorySlug: string;
  /** Whole QAR. */
  price: number;
  stock: number;
  tag?: string;
  colour: string;
  material: string;
  styleCode: string;
  description: string;
  details: string[];
  images: ProductImageData[];
  imageFit: "contain" | "cover";
};

export const seedProducts: SeedProduct[] = [
  {
    slug: "leather-satchel",
    name: "Leather satchel",
    categorySlug: "handbags",
    price: 11400,
    stock: 12,
    tag: "New",
    colour: "Dark brown",
    material: "Calf leather",
    styleCode: "MS-1001",
    description:
      "A structured satchel in smooth calf leather with twin buckled straps, a top handle and contrast edge stitching. Sized for daily essentials and a small tablet.",
    details: [
      "Dark brown calf leather",
      "Antique-brass-toned buckles",
      "Top handle and detachable shoulder strap",
      "Interior zip pocket",
      "W 30cm × H 22cm × D 9cm",
      "Made in Italy",
    ],
    images: [
      {
        src: unsplash("photo-1603219527847-24c87f552a77"),
        alt: "Dark brown leather satchel with buckled straps on a wooden stool",
      },
    ],
    imageFit: "cover",
  },
  {
    slug: "pointed-leather-pump",
    name: "Pointed leather pump",
    categorySlug: "shoes",
    price: 3650,
    stock: 2,
    colour: "White",
    material: "Calf leather",
    styleCode: "MS-2014",
    description:
      "A sleek pointed-toe pump in white calf leather on a slim stiletto heel, with a low-cut vamp that lengthens the line of the foot.",
    details: [
      "White calf leather",
      "Leather sole",
      "Pointed toe",
      "Heel height 9cm",
      "Made in Italy",
    ],
    images: [
      {
        src: unsplash("photo-1535043934128-cf0b28d52f95"),
        alt: "Pair of white pointed leather pumps on a wooden floor",
      },
      {
        src: unsplash("photo-1562687848-c1664eff566d"),
        alt: "Single white pointed leather pump, side view",
      },
    ],
    imageFit: "cover",
  },
  {
    slug: "printed-silk-scarf",
    name: "Printed silk scarf",
    categorySlug: "accessories",
    price: 1900,
    stock: 0,
    tag: "Exclusive",
    colour: "Multicolour",
    material: "Silk twill",
    styleCode: "MS-3307",
    description:
      "A generous square scarf in fluid silk twill, printed with an abstract pattern and finished with hand-rolled edges.",
    details: [
      "100% silk twill",
      "Hand-rolled edges",
      "90cm × 90cm",
      "Dry clean only",
      "Made in Italy",
    ],
    images: [
      {
        src: unsplash("photo-1777795530497-205664bbd965"),
        alt: "Printed silk scarf draped around a white plaster bust",
      },
      {
        src: unsplash("photo-1606259458027-54d2a728b6ab"),
        alt: "Close-up of draped silk fabric",
      },
    ],
    imageFit: "cover",
  },
  {
    slug: "leather-penny-loafer",
    name: "Leather penny loafer",
    categorySlug: "shoes",
    price: 3950,
    stock: 8,
    colour: "Burgundy brown",
    material: "Pebbled calf leather",
    styleCode: "MS-2040",
    description:
      "A classic penny loafer in pebbled calf leather with a hand-stitched apron toe and a lightly stacked heel.",
    details: [
      "Burgundy brown pebbled calf leather",
      "Hand-stitched apron toe",
      "Leather sole with rubber insert",
      "Heel height 2cm",
      "Made in Italy",
    ],
    images: [
      {
        src: unsplash("photo-1675947258177-aa8120ddefa3"),
        alt: "Pair of burgundy brown leather penny loafers on a white surface",
      },
    ],
    imageFit: "cover",
  },
  {
    slug: "top-handle-bag",
    name: "Top handle bag",
    categorySlug: "handbags",
    price: 8600,
    stock: 5,
    colour: "Red",
    material: "Calf leather",
    styleCode: "MS-1012",
    description:
      "A compact top handle bag in polished red calf leather with a twist-lock flap and a detachable strap, sized for the essentials.",
    details: [
      "Red calf leather",
      "Silver-toned twist lock",
      "Detachable shoulder strap",
      "W 24cm × H 18cm × D 10cm",
      "Made in Italy",
    ],
    images: [
      {
        src: unsplash("photo-1584917865442-de89df76afd3"),
        alt: "Red leather top handle bag on a white table",
      },
    ],
    imageFit: "cover",
  },
  {
    slug: "leather-tote",
    name: "Leather tote",
    categorySlug: "handbags",
    price: 6900,
    stock: 1,
    colour: "Tan",
    material: "Vegetable-tanned leather",
    styleCode: "MS-1020",
    description:
      "An open tote in supple vegetable-tanned leather that softens and darkens with use, with long handles to wear on the shoulder. Roomy enough for a laptop.",
    details: [
      "Tan vegetable-tanned leather",
      "Unlined interior with slip pocket",
      "Handle drop 24cm",
      "W 36cm × H 38cm × D 12cm",
      "Made in Italy",
    ],
    images: [
      {
        src: unsplash("photo-1624687943971-e86af76d57de"),
        alt: "Tan leather tote hanging against a white door",
      },
      {
        src: unsplash("photo-1760624294504-211e763ee0fb"),
        alt: "Woman seated holding a large tan leather tote",
      },
      {
        src: unsplash("photo-1760624294582-5341f33f9fa4"),
        alt: "Three leather totes in tan, cognac and natural",
      },
    ],
    imageFit: "cover",
  },
];
