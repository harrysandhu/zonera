// Public images are referenced relative to the document so the same paths work
// in the dev server, the built dist/ folder and the published artifact.
// The standalone build (scripts/standalone.mjs) inlines every image as a data
// URI in window.__ZONERA_IMG; img() prefers that map when it exists.
declare global {
  interface Window { __ZONERA_IMG?: Record<string, string> }
}

export const img = (p: string) => (typeof window !== "undefined" && window.__ZONERA_IMG?.["img/" + p]) || "img/" + p;

export const UNIT_IMG: Record<string, string> = {
  "5x5": img("units/5x5.webp"),
  "5x10": img("units/5x10.webp"),
  "10x10": img("units/10x10.webp"),
  "10x15": img("units/10x15.webp"),
  "10x20": img("units/10x20.webp"),
  "10x30": img("units/10x30.webp"),
  "12x40": img("units/10x30.webp"),
};

export const HERO = { clean: img("hero-2400.webp"), small: img("hero-1280.webp"), identity: img("hero-identity-2400.webp"), identitySmall: img("hero-identity-1280.webp") };
