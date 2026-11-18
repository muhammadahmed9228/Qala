import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import logoImg from "../assets/logo.jpeg";

const SITE_URL = (import.meta.env.VITE_SITE_URL || "https://qalaofficial.com").replace(/\/$/, "");
const DEFAULT_TITLE = "Qala | Timeless Eastern Wear";
const DEFAULT_DESCRIPTION = "Discover Qala's refined Eastern wear, crafted with timeless silhouettes, thoughtful detail, and effortless elegance.";

const truncate = (value, maxLength) => {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
};

const toAbsoluteUrl = (value) => {
  if (!value) return `${SITE_URL}${logoImg.startsWith("/") ? logoImg : `/${logoImg}`}`;
  if (/^https?:\/\//i.test(value)) return value;
  return `${SITE_URL}${value.startsWith("/") ? value : `/${value}`}`;
};

export default function SEO({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  canonicalPath,
  image,
  type = "website",
  noindex = false,
}) {
  const location = useLocation();
  const canonicalUrl = `${SITE_URL}${canonicalPath || location.pathname || "/"}`;
  const safeTitle = truncate(title, 60);
  const safeDescription = truncate(description, 160);
  const imageUrl = toAbsoluteUrl(image);

  return (
    <Helmet prioritizeSeoTags>
      <title>{safeTitle}</title>
      <meta name="description" content={safeDescription} />
      <meta name="robots" content={noindex ? "noindex, nofollow" : "index, follow"} />
      <link rel="canonical" href={canonicalUrl} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={safeTitle} />
      <meta property="og:description" content={safeDescription} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content="Qala" />
      <meta property="og:image" content={imageUrl} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={safeTitle} />
      <meta name="twitter:description" content={safeDescription} />
      <meta name="twitter:image" content={imageUrl} />
    </Helmet>
  );
}
