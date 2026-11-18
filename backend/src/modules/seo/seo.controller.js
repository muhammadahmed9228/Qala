import { asyncHandler } from "../../utils/asyncHandler.js";
import { Collection } from "../collections/collection.model.js";
import { Product } from "../products/product.model.js";

const PUBLIC_SITE_URL = (process.env.PUBLIC_SITE_URL || "https://qalaofficial.com").replace(/\/$/, "");

const STATIC_PUBLIC_PATHS = [
    "/",
    "/products",
    "/privacy-policy",
    "/shipping-policy",
    "/refund-policy",
    "/terms-and-conditions",
    "/disclaimer",
];

export const escapeXml = (value = "") => String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");

const makeUrlEntry = (path, lastmod) => {
    const lastmodTag = lastmod ? `<lastmod>${escapeXml(new Date(lastmod).toISOString())}</lastmod>` : "";
    return `<url><loc>${escapeXml(`${PUBLIC_SITE_URL}${path}`)}</loc>${lastmodTag}</url>`;
};

export const buildSitemapXml = ({ products = [], collections = [] } = {}) => {
    const staticEntries = STATIC_PUBLIC_PATHS.map((path) => makeUrlEntry(path));
    const collectionEntries = collections
        .filter((collection) => collection?.slug)
        .map((collection) => makeUrlEntry(`/collections/${encodeURIComponent(collection.slug)}`, collection.updatedAt));
    const productEntries = products
        .filter((product) => product?._id)
        .map((product) => makeUrlEntry(`/products/${product._id}`, product.updatedAt));

    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...staticEntries,
        ...collectionEntries,
        ...productEntries,
        "</urlset>",
    ].join("");
};

export const getSitemap = asyncHandler(async (req, res) => {
    const [products, collections] = await Promise.all([
        Product.find({ published: true, isDeleted: { $ne: true } })
            .select("_id updatedAt")
            .lean(),
        Collection.find({ enabled: true })
            .select("slug updatedAt")
            .lean(),
    ]);

    res
        .status(200)
        .type("application/xml")
        .set("Cache-Control", "public, max-age=300")
        .send(buildSitemapXml({ products, collections }));
});

export const getRobots = (req, res) => {
    const robots = [
        "User-agent: *",
        "Allow: /",
        "Allow: /products/",
        "Allow: /collections/",
        "Disallow: /admin",
        "Disallow: /cart",
        "Disallow: /checkout",
        "Disallow: /login",
        "Disallow: /register",
        "Disallow: /profile",
        "Disallow: /api/",
        `Sitemap: ${PUBLIC_SITE_URL}/sitemap.xml`,
        "",
    ].join("\n");

    res
        .status(200)
        .type("text/plain")
        .set("Cache-Control", "public, max-age=300")
        .send(robots);
};

