import type { MetadataRoute } from "next";
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const prod = process.env.APP_ENV === "production";
  return {
    rules: prod ? { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/settings", "/activity", "/dev"] } : { userAgent: "*", disallow: "/" },
    sitemap: `${base}/sitemap.xml`,
  };
}
