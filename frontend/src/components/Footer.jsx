import logoImg from "../assets/logo.jpeg"

export default function Footer() {

  return (
       <footer className="border-t border-neutral-200 bg-neutral-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img
                  src={logoImg}
                  alt="Qala Logo"
                  className="h-10 w-auto object-contain"
                />
                <span className="font-sans font-semibold tracking-[0.18em] text-sm uppercase text-white">
                  Qala
                </span>
              </div>
              <p className="text-neutral-400 leading-relaxed">
                Qala is a contemporary fashion label rooted in traditional craftsmanship and modern elegance. We reimagine traditional artistry for the modern woman through minimal silhouettes, rich handcrafted techniques, and refined embellishment.
                
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
                    href="https://instagram.com"
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

          <div className="mt-10 border-t border-neutral-700 pt-6 text-center text-sm text-neutral-400">
            <p>
              © {new Date().getFullYear()} Qala. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
  );
}
