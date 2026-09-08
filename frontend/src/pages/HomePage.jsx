import { Fragment, useRef, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getPublicHeroSlidesApi } from "../features/homepage/api/homeApi"
import { getPublicHomeSectionsApi } from "../features/admin/api/adminApi";
import { getProductsApi, getPublicCollectionsApi } from "../features/products/api/productsApi";
import HeroCarousel from "../features/homepage/components/HeroCarousel";
import ProductCard from "../features/products/components/ProductCard";
import HomePageSkeleton from "../components/HomePageSkeleton";

export default function HomePage() {
  const [slides, setSlides] = useState([]);
  const [collections, setCollections] = useState([]);
  const [dynamicSections, setDynamicSections] = useState([]); // Array of { sectionData, products }
  const [sectionScrollPositions, setSectionScrollPositions] = useState({}); // Track scroll position per section
  const [transitioningSections, setTransitioningSections] = useState({}); // Track which sections are transitioning
  const [collectionPosition, setCollectionPosition] = useState(0);
  const [visibleCollectionCount, setVisibleCollectionCount] = useState(3);
  const [loading, setLoading] = useState(true);
  const collectionTouchStartX = useRef(null);
  const sectionTouchStartX = useRef({});

  useEffect(() => {
    const fetchHomeData = async () => {
      try {
        // 1. Fetch foundational data
        const [slidesRes, collectionsRes, sectionsRes] = await Promise.all([
          getPublicHeroSlidesApi({ limit: 10 }),
          getPublicCollectionsApi({ limit: 10 }),
          getPublicHomeSectionsApi({ limit: 10 })
        ]);
        
        setSlides(slidesRes.data.slides || slidesRes.data);
        setCollections(collectionsRes.data.collections || collectionsRes.data);

        // 2. Fetch products for EACH dynamic section dynamically!
        const sectionsData = sectionsRes.data.sections || sectionsRes.data;
        const populatedSections = await Promise.all(
          sectionsData.map(async (sec) => {
            let params = { limit: 12 }; // Fetch 12 items to allow carousel navigation
            
            // Map the section criteria to our robust product sorting API
            if (sec.criteria === 'newest') params.sort = 'createdAt';
            if (sec.criteria === 'bestselling') params.sort = 'bestselling';
            if (sec.criteria === 'featured') params.sort = 'featured';
            if (sec.criteria === 'collection' && sec.collectionRef) params.collection = sec.collectionRef._id || sec.collectionRef;

            const pRes = await getProductsApi(params);
            return { ...sec, products: pRes.data.products || pRes.data };
          })
        );
        
        setDynamicSections(populatedSections);
        // Initialize scroll positions
        const initialPositions = {};
        populatedSections.forEach(section => {
          initialPositions[section._id] = 0;
        });
        setSectionScrollPositions(initialPositions);
      } catch (error) {
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
    return () => window.removeEventListener("resize", updateCollectionLayout);
  }, [collections.length]);

  const handleScroll = (sectionId, direction, productsLength) => {
    // Start transition (fade out)
    setTransitioningSections(prev => ({ ...prev, [sectionId]: true }));
    
    // After fade out, update position and fade back in
    setTimeout(() => {
      setSectionScrollPositions(prev => {
        const currentPosition = prev[sectionId] || 0;
        let newPosition = currentPosition;
        
        if (direction === 'next') {
          newPosition = Math.min(currentPosition + 4, Math.max(0, productsLength - 4));
        } else {
          newPosition = Math.max(currentPosition - 4, 0);
        }
        
        return { ...prev, [sectionId]: newPosition };
      });
      
      // End transition (fade in)
      setTransitioningSections(prev => ({ ...prev, [sectionId]: false }));
    }, 300);
  };

  const handleCollectionTouchStart = (event) => {
    collectionTouchStartX.current = event.touches[0].clientX;
  };

  const handleCollectionTouchEnd = (event) => {
    if (collectionTouchStartX.current === null || collections.length < 2) return;

    const distance = event.changedTouches[0].clientX - collectionTouchStartX.current;
    if (Math.abs(distance) > 45) {
      if (distance < 0) {
        setCollectionPosition((position) => Math.min(collectionMaxPosition, position + 1));
      } else {
        setCollectionPosition((position) => Math.max(0, position - 1));
      }
    }
    collectionTouchStartX.current = null;
  };

  const handleSectionTouchStart = (sectionId, event) => {
    sectionTouchStartX.current[sectionId] = event.touches[0].clientX;
  };

  const handleSectionTouchEnd = (sectionId, productsLength, event) => {
    const startX = sectionTouchStartX.current[sectionId];
    if (startX === undefined || productsLength <= 4) return;

    const distance = event.changedTouches[0].clientX - startX;
    if (Math.abs(distance) > 45) {
      handleScroll(sectionId, distance < 0 ? "next" : "prev", productsLength);
    }
    delete sectionTouchStartX.current[sectionId];
  };

  const collectionMaxPosition = Math.max(0, collections.length - visibleCollectionCount);
  const visibleCollections = collections.slice(
    collectionPosition,
    collectionPosition + visibleCollectionCount + 1,
  );

  const collectionSection = collections.length > 0 && (
    <section className="mx-auto max-w-7xl px-1 pt-1 md:px-4 md:pt-6">
      <div className="mb-4 flex items-end justify-between gap-3 md:mb-6">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-qala-bronze">Explore the edit</p>
          <h2 className="text-3xl font-medium text-qala-espresso md:text-4xl">Shop by Collection</h2>
        </div>
      </div>
      <div className="relative">
        <div
          className="flex gap-4 overflow-hidden touch-pan-y md:gap-6"
          onTouchStart={handleCollectionTouchStart}
          onTouchEnd={handleCollectionTouchEnd}
        >
        {visibleCollections.map(col => (
          <div key={col._id} className="group relative h-72 min-w-[calc(50%-0.5rem)] overflow-hidden bg-qala-espresso md:h-[26rem] md:min-w-[calc(33.333%-1rem)] md:flex-1">
            {col.image?.url && (
              <img src={col.image.url} alt={col.name} className="absolute inset-0 w-full h-full object-cover opacity-60 transition duration-700 group-hover:scale-105" />
            )}
            <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/20 to-transparent" />
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10">
              <h3 className="mb-4 text-3xl font-medium text-white md:text-4xl">{col.name}</h3>
              <Link to={`/collections/${col.slug}`} className="border border-white/70 px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-white hover:text-qala-espresso md:px-6">
                See More
              </Link>
            </div>
          </div>
        ))}
        </div>
        <button
          type="button"
          onClick={() => setCollectionPosition((position) => Math.max(0, position - 1))}
          disabled={collectionPosition === 0}
          aria-label="Previous collection"
          className="absolute left-0 top-1/2 z-10 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center border border-qala-bronze bg-qala-cream text-qala-bronze transition hover:bg-qala-bronze hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setCollectionPosition((position) => Math.min(collectionMaxPosition, position + 1))}
          disabled={collectionPosition >= collectionMaxPosition}
          aria-label="Next collection"
          className="absolute right-0 top-1/2 z-10 flex h-10 w-10 translate-x-1/2 -translate-y-1/2 items-center justify-center border border-qala-bronze bg-qala-cream text-qala-bronze transition hover:bg-qala-bronze hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>
    </section>
  );
  const collectionInsertIndex = Math.ceil(dynamicSections.length / 2);

  if (loading) return <HomePageSkeleton />;

  return (
    <div className="space-y-6 pb-12 md:space-y-10 md:pb-16">
      <div>
        <HeroCarousel slides={slides} />
      </div>

      {/* Render Dynamic Sections created by Admin */}
      {dynamicSections.map((section, sectionIndex) => {
        const currentPosition = sectionScrollPositions[section._id] || 0;
        const visibleProducts = section.products.slice(currentPosition, currentPosition + 4);
        const canScrollPrev = currentPosition > 0;
        const canScrollNext = currentPosition + 4 < section.products.length;
        const viewMorePath = section.criteria === 'collection' && section.collectionRef
          ? `/collections/${section.collectionRef.slug}`
          : `/products?sort=${section.criteria === 'featured' ? 'featured' : section.criteria === 'bestselling' ? 'bestselling' : 'createdAt'}`;

        return (
        <Fragment key={section._id}>
        <section key={section._id} className="mx-auto max-w-7xl border-t border-qala-champagne/70 px-2 py-5 md:px-4 md:py-8">
          <div className="mb-4 flex flex-col items-start gap-3 md:mb-6 md:flex-row md:items-end md:justify-between">
            <div className="w-full text-left">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-qala-bronze">The Qala edit</p>
              <h2 className="mb-1 text-3xl font-medium text-qala-espresso md:text-4xl">{section.title}</h2>
              {section.subtitle && <p className="max-w-xl text-sm leading-relaxed text-neutral-600 md:text-base">{section.subtitle}</p>}
            </div>
            <Link
              to={viewMorePath}
              className="inline-flex h-fit shrink-0 items-center justify-center self-end border border-qala-espresso px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-qala-espresso transition duration-200 hover:bg-qala-espresso hover:text-white md:self-auto md:px-7"
            >
              View More
            </Link>
          </div>
          
          <div
            className="relative group touch-pan-y"
            onTouchStart={(event) => handleSectionTouchStart(section._id, event)}
            onTouchEnd={(event) => handleSectionTouchEnd(section._id, section.products.length, event)}
          >
            <div className={`grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-4 md:gap-7 transition-all duration-300 ease-in-out ${
              transitioningSections[section._id] ? 'opacity-0' : 'opacity-100'
            }`}>
              {visibleProducts.length > 0 ? (
                visibleProducts.map((product, idx) => (
                  <div 
                    key={product._id} 
                    className="transition-all duration-500 ease-out hover:-translate-y-1 animate-fadeIn"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <ProductCard product={product} />
                  </div>
                ))
              ) : (
                <p className="col-span-full text-center text-neutral-500 py-4">Coming soon...</p>
              )}
            </div>

            {/* Chevron Navigation Buttons */}
            {section.products.length > 4 && (
              <>
                {/* Left Chevron */}
                <button
                  onClick={() => handleScroll(section._id, 'prev', section.products.length)}
                  disabled={!canScrollPrev}
                  className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-6 md:-translate-x-12 z-10 flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-full transition-all duration-300 ${
                    canScrollPrev
                      ? 'bg-qala-bronze text-white hover:bg-qala-espresso hover:scale-110 hover:shadow-lg hover:-translate-x-7 md:hover:-translate-x-14 cursor-pointer'
                        : 'bg-qala-champagne/50 text-qala-bronze/50 cursor-not-allowed opacity-40'
                  }`}
                  aria-label="Previous products"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-6 h-6 md:w-7 md:h-7 transition-transform duration-300"
                  >
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                </button>

                {/* Right Chevron */}
                <button
                  onClick={() => handleScroll(section._id, 'next', section.products.length)}
                  disabled={!canScrollNext}
                  className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-6 md:translate-x-12 z-10 flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-full transition-all duration-300 ${
                    canScrollNext
                      ? 'bg-qala-bronze text-white hover:bg-qala-espresso hover:scale-110 hover:shadow-lg hover:translate-x-7 md:hover:translate-x-14 cursor-pointer'
                        : 'bg-qala-champagne/50 text-qala-bronze/50 cursor-not-allowed opacity-40'
                  }`}
                  aria-label="Next products"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-6 h-6 md:w-7 md:h-7 transition-transform duration-300"
                  >
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </button>
              </>
            )}
          </div>
        </section>
        {sectionIndex + 1 === collectionInsertIndex && collectionSection}
        </Fragment>
        );
      })}

      {dynamicSections.length === 0 && collectionSection}
    </div>
  );
}