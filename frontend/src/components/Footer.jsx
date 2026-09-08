import logoImg from "../assets/logo.jpeg";

export default function Footer() {
  return (
    <footer className="border-t border-qala-espresso bg-qala-espresso text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img
                src={logoImg}
                alt="Qala Logo"
                className="h-10 w-auto object-contain"
              />
              <span className="font-sans text-sm font-semibold uppercase tracking-[0.18em] text-qala-champagne">
                Qala
              </span>
            </div>
            <p className="leading-relaxed text-neutral-400">
              Qala is a contemporary fashion label rooted in traditional
              craftsmanship and modern elegance. We reimagine traditional
              artistry for the modern woman through minimal silhouettes, rich
              handcrafted techniques, and refined embellishment.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold tracking-wide uppercase text-white">
              Customer Support
            </h3>
            <ul className="mt-4 space-y-3 text-sm text-neutral-300">
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Complain
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Need Help
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Store Address
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Contact
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold tracking-wide uppercase text-white">
              Menu
            </h3>
            <ul className="mt-4 space-y-3 text-sm text-neutral-300">
              <li>
                <a href="/" className="hover:text-white transition-colors">
                  Home page
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Shop
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  New Arrivals
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Best Sellers
                </a>
              </li>
            </ul>

            <div className="mt-6">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-white">
                Social
              </h4>
              <div className="mt-3 flex flex-wrap gap-3 text-sm text-neutral-300">
                <a
                  href="https://www.instagram.com/qala.official__?utm_source=ig_web_button_share_sheet&stkn=ZDNlZDc0MzIxNw=="
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Instagram
                </a>
                <a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Facebook
                </a>
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Twitter
                </a>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold tracking-wide uppercase text-white">
              INFORMATION
            </h3>
            <ul className="mt-4 space-y-3 text-sm text-neutral-300">
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Disclaimer
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Refund Policy
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Shipping Policy
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors">
                  Terms and Conditions
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-qala-bronze/40 pt-8">
          <div className="mb-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-qala-champagne">
              Crafted by
            </p>
            <h3 className="mt-2 text-2xl font-medium text-white">
              Development Team
            </h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="border border-white/10 px-4 py-4">
              <p className="font-medium text-white">Wamiq Siraj</p>
              <div className="mt-2 flex flex-col gap-1 text-sm text-neutral-400 sm:flex-row sm:flex-wrap sm:gap-x-4">
                <a
                  href="tel:+923001234567"
                  className="transition hover:text-qala-champagne"
                >
                  +92 327 0774028
                </a>
                <p className="font-medium text-white">Instagram:</p>
                <a
                  href="https://www.instagram.com/wamiq_siraj"
                  target="_blank"
                  rel="noreferrer"
                  className="transition hover:text-qala-champagne"
                >
                  @wamiq_siraj
                </a>
                <p className="font-medium text-white">Email:</p>
                <a
                  href="mailto:wamiqsiraj2@gmail.com"
                  className="transition hover:text-qala-champagne"
                >
                  wamiqsiraj2@gmail.com
                </a>
              </div>
            </div>
            <div className="border border-white/10 px-4 py-4">
              <p className="font-medium text-white">Muhammad Ahmed</p>
              <div className="mt-2 flex flex-col gap-1 text-sm text-neutral-400 sm:flex-row sm:flex-wrap sm:gap-x-4">
                <a
                  href="tel:+923111234567"
                  className="transition hover:text-qala-champagne"
                >
                  +92 322 5304113
                </a>
                <p className="font-medium text-white">Instagram:</p>
                <a
                  href="https://www.instagram.com/m_ahmed9228"
                  target="_blank"
                  rel="noreferrer"
                  className="transition hover:text-qala-champagne"
                >
                  @m_ahmed9228
                </a>
                <p className="font-medium text-white">Email:</p>
                <a
                  href="mailto:muhammadahmed9228@gmail.com"
                  className="transition hover:text-qala-champagne"
                >
                  muhammadahmed9228@gmail.com
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-neutral-700 pt-6 text-center text-sm text-neutral-400">
          <p>© {new Date().getFullYear()} Qala. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
