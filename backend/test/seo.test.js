import assert from "node:assert/strict";
import test from "node:test";
import { buildSitemapXml, escapeXml } from "../src/modules/seo/seo.controller.js";

test("SEO XML values are escaped", () => {
    assert.equal(escapeXml("A & B <C> \"D\" 'E'"), "A &amp; B &lt;C&gt; &quot;D&quot; &apos;E&apos;");
});

test("sitemap contains public static, collection, and product URLs", () => {
    const sitemap = buildSitemapXml({
        products: [{ _id: "product-1", updatedAt: "2026-11-18T00:00:00.000Z" }],
        collections: [{ slug: "ready & wear", updatedAt: "2026-11-17T00:00:00.000Z" }],
    });

    assert.match(sitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
    assert.match(sitemap, /https:\/\/qalaofficial\.com\/<\/loc>/);
    assert.match(sitemap, /https:\/\/qalaofficial\.com\/products\/product-1<\/loc>/);
    assert.match(sitemap, /https:\/\/qalaofficial\.com\/collections\/ready%20%26%20wear<\/loc>/);
    assert.match(sitemap, /<lastmod>2026-11-18T00:00:00\.000Z<\/lastmod>/);
});
