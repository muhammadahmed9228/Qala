import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const distDirectory = path.join(projectRoot, "dist");

const readLocalEnv = async () => {
  try {
    const content = await fs.readFile(path.join(projectRoot, ".env"), "utf8");
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
      if (match && process.env[match[1]] === undefined) {
        process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
      }
    }
  } catch {
    // Production build environments normally provide these variables directly.
  }
};

const escapeHtml = (value) => String(value || "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

const truncate = (value, maxLength) => {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
};

const absoluteUrl = (value, siteUrl) => {
  if (!value) return `${siteUrl}/src/assets/logo.jpeg`;
  return /^https?:\/\//i.test(value)
    ? value
    : `${siteUrl}${value.startsWith("/") ? value : `/${value}`}`;
};

const buildHead = ({ title, description, canonicalPath, image, type = "website", noindex = false, siteUrl }) => {
  const safeTitle = truncate(title, 60);
  const safeDescription = truncate(description, 160);
  const canonicalUrl = `${siteUrl}${canonicalPath}`;
  const imageUrl = absoluteUrl(image, siteUrl);

  return [
    `<title>${escapeHtml(safeTitle)}</title>`,
    `<meta name="description" content="${escapeHtml(safeDescription)}">`,
    `<meta name="robots" content="${noindex ? "noindex, nofollow" : "index, follow"}">`,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}">`,
    `<meta property="og:type" content="${escapeHtml(type)}">`,
    `<meta property="og:title" content="${escapeHtml(safeTitle)}">`,
    `<meta property="og:description" content="${escapeHtml(safeDescription)}">`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}">`,
    `<meta property="og:site_name" content="Qala">`,
    `<meta property="og:image" content="${escapeHtml(imageUrl)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeHtml(safeTitle)}">`,
    `<meta name="twitter:description" content="${escapeHtml(safeDescription)}">`,
    `<meta name="twitter:image" content="${escapeHtml(imageUrl)}">`,
  ].join("\n    ");
};

const fetchJson = async (url) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
};

const fetchAll = async (apiBaseUrl, resource, collectionKey) => {
  const firstResponse = await fetchJson(`${apiBaseUrl}/${resource}?page=1&limit=100`);
  const firstData = firstResponse.data || firstResponse;
  const records = [...(firstData[collectionKey] || firstData || [])];
  const pages = Number(firstData.pages || 1);

  for (let page = 2; page <= pages; page += 1) {
    const response = await fetchJson(`${apiBaseUrl}/${resource}?page=${page}&limit=100`);
    const data = response.data || response;
    records.push(...(data[collectionKey] || []));
  }

  return records;
};

const renderSnapshot = (template, seo, body = "") => {
  const head = buildHead(seo);
  const withTitle = template
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/\s*<meta\s+name=["']description["'][^>]*>/i, "")
    .replace("</head>", `    ${head}\n  </head>`);
  if (!body) return withTitle;
  return withTitle.replace('<div id="root"></div>', `<div id="root">${body}</div>`);
};

const buildSitemapXml = ({ products = [], collections = [] } = {}) => {
  const indexableStaticRoutes = staticRoutes.filter((route) => !route.noindex);
  const paths = [
    ...indexableStaticRoutes.map((route) => ({ path: route.route })),
    ...collections
      .filter((collection) => collection?.slug)
      .map((collection) => ({
        path: `/collections/${encodeURIComponent(collection.slug)}`,
        lastmod: collection.updatedAt,
      })),
    ...products
      .filter((product) => product?._id)
      .map((product) => ({
        path: `/products/${product._id}`,
        lastmod: product.updatedAt,
      })),
  ];

  const entries = paths.map(({ path: routePath, lastmod }) => {
    const lastmodTag = lastmod ? `<lastmod>${escapeHtml(new Date(lastmod).toISOString())}</lastmod>` : "";
    return `<url><loc>${escapeHtml(`${siteUrl}${routePath}`)}</loc>${lastmodTag}</url>`;
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    "</urlset>",
  ].join("");
};

const writeSeoFiles = async (records = {}) => {
  await fs.writeFile(path.join(distDirectory, "sitemap.xml"), buildSitemapXml(records), "utf8");
  await fs.writeFile(path.join(distDirectory, "robots.txt"), [
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
    `Sitemap: ${siteUrl}/sitemap.xml`,
    "",
  ].join("\n"), "utf8");
};

const writeRouteSnapshot = async (template, route, seo, body) => {
  const routeDirectory = route === "/"
    ? distDirectory
    : path.join(distDirectory, route.replace(/^\/+|\/+$/g, ""));
  await fs.mkdir(routeDirectory, { recursive: true });
  await fs.writeFile(path.join(routeDirectory, "index.html"), renderSnapshot(template, seo, body), "utf8");
};

await readLocalEnv();

const siteUrl = (process.env.VITE_SITE_URL || "https://qalaofficial.com").replace(/\/$/, "");
const apiBaseUrl = (process.env.PRERENDER_API_BASE_URL || process.env.VITE_API_BASE_URL || "http://localhost:4000/api/v1").replace(/\/$/, "");
const template = await fs.readFile(path.join(distDirectory, "index.html"), "utf8");

const staticRoutes = [
  { route: "/", title: "Qala | Timeless Eastern Wear", description: "Shop Qala's refined Eastern wear and thoughtfully crafted silhouettes for effortless, modern elegance." },
  { route: "/products", title: "Shop Eastern Wear | Qala", description: "Explore Qala's collection of refined Eastern wear, timeless silhouettes, and contemporary handcrafted styles." },
  { route: "/login", title: "Customer Login | Qala", description: "Sign in to your Qala account and manage your orders.", noindex: true },
  { route: "/register", title: "Create Account | Qala", description: "Create your Qala account for a smoother shopping experience.", noindex: true },
  { route: "/privacy-policy", title: "Privacy Policy | Qala", description: "Learn how Qala collects, uses, and protects customer information." },
  { route: "/shipping-policy", title: "Shipping Policy | Qala", description: "Learn about Qala delivery timelines, shipping charges, and order fulfillment." },
  { route: "/refund-policy", title: "Refund & Returns | Qala", description: "Review Qala's refund, return, and exchange policy for customer orders." },
  { route: "/terms-and-conditions", title: "Terms & Conditions | Qala", description: "Read the terms and conditions that apply to shopping with Qala." },
  { route: "/disclaimer", title: "Disclaimer | Qala", description: "Read Qala's product, service, and website disclaimer." },
];

await writeSeoFiles();

for (const route of staticRoutes) {
  await writeRouteSnapshot(template, route.route, {
    ...route,
    canonicalPath: route.route,
    siteUrl,
  });
}

try {
  const [products, collections] = await Promise.all([
    fetchAll(apiBaseUrl, "products", "products"),
    fetchAll(apiBaseUrl, "collections", "collections"),
  ]);

  for (const product of products) {
    const collectionName = product.collectionRef?.name || product.collection?.name || "Qala's Eastern wear";
    await writeRouteSnapshot(template, `/products/${product._id}`, {
      title: `${product.name} | Qala`,
      description: `${product.name} from ${collectionName}. ${product.description || "Discover refined craftsmanship and timeless style."}`,
      canonicalPath: `/products/${product._id}`,
      image: product.thumbnail?.url,
      type: "product",
      siteUrl,
    }, `<main><h1>${escapeHtml(product.name)}</h1><p>${escapeHtml(product.description || `Discover ${product.name} from Qala.`)}</p></main>`);
  }

  for (const collection of collections) {
    await writeRouteSnapshot(template, `/collections/${collection.slug}`, {
      title: `${collection.name} | Qala Collection`,
      description: `${collection.description || `Explore ${collection.name} from Qala's refined Eastern wear collection.`} Shop timeless style at Qala.`,
      canonicalPath: `/collections/${collection.slug}`,
      image: collection.image?.url,
      siteUrl,
    }, `<main><h1>${escapeHtml(collection.name)}</h1><p>${escapeHtml(collection.description || `Explore the ${collection.name} collection at Qala.`)}</p></main>`);
  }

  await writeSeoFiles({ products, collections });

  console.log(`SEO prerendered ${products.length} products and ${collections.length} collections.`);
} catch (error) {
  await writeSeoFiles();
  console.warn(`SEO dynamic route prerender skipped: ${error.message}`);
}
