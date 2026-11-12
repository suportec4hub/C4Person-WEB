import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/C4Person/", "/api/", "/admin/", "/assinar/"],
      },
      // Allow AI crawlers to index the landing page
      {
        userAgent: "GPTBot",
        allow: "/",
        disallow: ["/C4Person/", "/api/", "/admin/"],
      },
      {
        userAgent: "Claude-Web",
        allow: "/",
        disallow: ["/C4Person/", "/api/", "/admin/"],
      },
      {
        userAgent: "PerplexityBot",
        allow: "/",
        disallow: ["/C4Person/", "/api/", "/admin/"],
      },
    ],
    sitemap: "https://c4person.com.br/sitemap.xml",
    host: "https://c4person.com.br",
  };
}
