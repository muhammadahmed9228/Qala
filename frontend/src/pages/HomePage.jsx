import { Fragment, useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getPublicHeroSlidesApi } from "../features/homepage/api/homeApi";
import { getPublicHomeSectionsWithProductsApi } from "../features/admin/api/adminApi";
import { getPublicCollectionsApi } from "../features/products/api/productsApi";
import HeroCarousel from "../features/homepage/components/HeroCarousel";
import ProductCarousel from "../features/products/components/ProductCarousel";
import HomePageSkeleton from "../components/HomePageSkeleton";
import SEO from "../components/SEO";

export default function HomePage() {
  const [slides, setSlides] = useState([]);
  const [collections, setCollections] = useState([]);
  const [dynamicSections, setDynamicSections] = useState([]); // Array of { sectionData, products }
  const [collectionPosition, setCollectionPosition] = useState(0);
  const [visibleCollectionCount, setVisibleCollectionCount] = useState(3);
  const [loading, setLoading] = useState(true);
  const collectionTouchStartX = useRef(null);

  useEffect(() => {
    const fetchHomeData = async () => {
      try {
        // 1. Fetch foundational data
        const [slidesRes, collectionsRes, sectionsRes] = await Promise.all([
          getPublicHeroSlidesApi({ limit: 10 }),
          getPublicCollectionsApi({ limit: 10 }),
          getPublicHomeSectionsWithProductsApi(),
        ]);

        setSlides(slidesRes.data.slides || slidesRes.data);
        setCollections(collectionsRes.data.collections || collectionsRes.data);

        // Products for dynamic sections are returned by the same backend
        // request, avoiding one API/database query per section.
        const sectionsData = sectionsRes.data.sections || sectionsRes.data;
        setDynamicSections(sectionsData);
      } catch {
        console.error("Failed to load homepage data");
      } finally {
        setLoading(false);
      }
    };
    fetchHomeData();
  }, []);

  useEffect(() => {
    const updateCollectionLayout = () => {
      const nextVisibleCount = window.innerWidth < 768 ? 2 : 3;
      setVisibleCollectionCount(nextVisibleCount);
      setCollectionPosition((position) =>
        Math.min(position, Math.max(0, collections.length - nextVisibleCount)),
      );
    };

    updateCollectionLayout();
    window.addEventListener("resize", updateCollectionLayout);
    return () => {
      window.removeEventListener("resize", updateCollectionLayout);
    };
  }, [collections.length]);

  const handleCollectionTouchStart = (event) => {
    collectionTouchStartX.current = event.touches[0].clientX;
  };

  const handleCollectionTouchEnd = (event) => {
    if (collectionTouchStartX.current === null || collections.length < 2) return;

    const distance =
      event.changedTouches[0].clientX - collectionTouchStartX.current;
    if (Math.abs(distance) > 45) {
      if (distance < 0) {
        setCollectionPosition((position) =>
          Math.min(collectionMaxPosition, position + 1),
        );
      } else {
        setCollectionPosition((position) => Math.max(0, position - 1));
      }
    }
    collectionTouchStartX.current = null;
  };

  const collectionMaxPosition = Math.max(
    0,
    collections.length - visibleCollectionCount,
  );
  const visibleCollections = collections.slice(
    collectionPosition,
    collectionPosition + visibleCollectionCount + 1,
  );

  const collectionSection = collections.length > 0 && (
    <section className="mx-auto max-w-7xl px-1 pt-1 md:px-4 md:pt-6">
      <div className="mb-4 flex items-end justify-between gap-3 md:mb-6">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-qala-bronze">
            Explore the edit
          </p>
          <h2 className="text-3xl font-medium text-qala-espresso md:text-4xl">
            Shop by Collection
          </h2>
        </div>
      </div>
      <div className="relative">
        <div
          className="flex gap-4 overflow-hidden touch-pan-y md:gap-6"
          onTouchStart={handleCollectionTouchStart}
          onTouchEnd={handleCollectionTouchEnd}
        >
          {visibleCollections.map((col) => (
            <div
              key={col._id}
              className="group relative h-72 min-w-[calc(50%-0.5rem)] overflow-hidden bg-qala-espresso md:h-[26rem] md:min-w-[calc(33.333%-1rem)] md:flex-1"
            >
              {col.image?.url && (
                <img
                  src={col.image.url}
                  alt={col.name}
                  className="absolute inset-0 w-full h-full object-cover opacity-60 transition duration-700 group-hover:scale-105"
                />
              )}
              <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/20 to-transparent" />
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10">
                <h3 className="mb-4 text-3xl font-medium text-white md:text-4xl">
                  {col.name}
                </h3>
                <Link
                  to={`/collections/${col.slug}`}
                  className="border border-white/70 px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-white hover:text-qala-espresso md:px-6"
                >
                  See More
                </Link>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            setCollectionPosition((position) => Math.max(0, position - 1))
          }
          disabled={collectionPosition === 0}
          aria-label="Previous collection"
          className="absolute left-0 top-1/2 z-10 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center border border-qala-bronze bg-qala-cream text-qala-bronze transition hover:bg-qala-bronze hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="h-5 w-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m15 18-6-6 6-6"
            />
          </svg>
        </button>
        <button
          type="button"
          onClick={() =>
            setCollectionPosition((position) =>
              Math.min(collectionMaxPosition, position + 1),
            )
          }
          disabled={collectionPosition >= collectionMaxPosition}
          aria-label="Next collection"
          className="absolute right-0 top-1/2 z-10 flex h-10 w-10 translate-x-1/2 -translate-y-1/2 items-center justify-center border border-qala-bronze bg-qala-cream text-qala-bronze transition hover:bg-qala-bronze hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="h-5 w-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m9 18 6-6-6-6"
            />
          </svg>
        </button>
      </div>
    </section>
  );
  const collectionInsertIndex = Math.ceil(dynamicSections.length / 2);

  if (loading) return <HomePageSkeleton />;

  return (
    <div className="space-y-6 pb-12 md:space-y-10 md:pb-16">
      <SEO
        title="Qala | Timeless Eastern Wear"
        description="Shop Qala's refined Eastern wear and thoughtfully crafted silhouettes for effortless, modern elegance."
        canonicalPath="/"
      />
      <div>
        <HeroCarousel slides={slides} />
      </div>

      {/* Render Dynamic Sections created by Admin */}
      {dynamicSections.map((section, sectionIndex) => {
        const viewMorePath =
          section.criteria === "collection" && section.collectionRef
            ? `/collections/${section.collectionRef.slug}`
            : `/products?sort=${
                section.criteria === "featured"
                  ? "featured"
                  : section.criteria === "bestselling"
                  ? "bestselling"
                  : "createdAt"
              }`;

        return (
          <Fragment key={section._id}>
            <section className="mx-auto max-w-7xl border-t border-qala-champagne/70 px-2 py-5 md:px-4 md:py-8">
              <div className="mb-4 flex flex-col items-start gap-3 md:mb-6 md:flex-row md:items-end md:justify-between">
                <div className="w-full text-left">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-qala-bronze">
                    The Qala edit
                  </p>
                  <h2 className="mb-1 text-3xl font-medium text-qala-espresso md:text-4xl">
                    {section.title}
                  </h2>
                  {section.subtitle && (
                    <p className="max-w-xl text-sm leading-relaxed text-neutral-600 md:text-base">
                      {section.subtitle}
                    </p>
                  )}
                </div>
                <Link
                  to={viewMorePath}
                  className="inline-flex h-fit shrink-0 items-center justify-center self-end border border-qala-espresso px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-qala-espresso transition duration-200 hover:bg-qala-espresso hover:text-white md:self-auto md:px-7"
                >
                  View More
                </Link>
              </div>

              <ProductCarousel products={section.products || []} />
            </section>
            {sectionIndex + 1 === collectionInsertIndex && collectionSection}
          </Fragment>
        );
      })}

      {dynamicSections.length === 0 && collectionSection}

    </div>
  );
}