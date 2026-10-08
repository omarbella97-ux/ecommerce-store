import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist } from "next/font/google";
import { BagCount } from "@/components/bag-count";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader, SiteHeaderView } from "@/components/site-header";
import { site } from "@/lib/site";
import "./globals.css";

// The only typeface: UI, headings (bold) and display (light) — font-sans.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: site.name, template: `%s | ${site.name}` },
  description: site.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Suspense
          fallback={
            <SiteHeaderView
              isHome={false}
              bagCount={
                <Suspense fallback={null}>
                  <BagCount />
                </Suspense>
              }
            />
          }
        >
          <SiteHeader
            bagCount={
              <Suspense fallback={null}>
                <BagCount />
              </Suspense>
            }
          />
        </Suspense>
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
