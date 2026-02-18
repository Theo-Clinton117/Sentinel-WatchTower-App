class CustomNavbar extends HTMLElement {
  connectedCallback() {
    const path = window.location.pathname.toLowerCase();
    const links = [
      { href: "./home.html", label: "Home", match: ["home.html", "/"] },
      { href: "./dashboard.html", label: "Profile", match: ["dashboard.html", "reviewer-dashboard.html", "admin-dashboard.html"] },
      { href: "./login.html", label: "Auth", match: ["login.html"] }
    ];

    const linkHtml = links.map(link => {
      const active = link.match.some(m => path.endsWith(m)) || (path === "/" && link.href.includes("home"));
      const activeClass = active ? "bg-blue-600 text-white" : "bg-gray-700/50 text-gray-200 hover:bg-gray-700";
      return `<a href="${link.href}" class="px-3 py-2 rounded text-xs ${activeClass}" aria-current="${active ? "page" : "false"}">${link.label}</a>`;
    }).join("");

    this.innerHTML = `
      <header class="fixed top-0 inset-x-0 z-50 border-b border-gray-700 bg-gray-900/90 backdrop-blur-sm">
        <div class="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-3">
          <a href="./home.html" class="flex items-center gap-2 text-sm font-semibold text-blue-300">
            <span class="w-2 h-2 rounded-full bg-red-500"></span>
            Sentinel WatchTower
          </a>
          <nav class="nav-desktop flex items-center gap-2" aria-label="Primary">
            ${linkHtml}
          </nav>
          <button id="mobileMenuToggle" class="nav-mobile-toggle rounded bg-gray-700/50 text-gray-100 px-3 py-2" aria-label="Open menu" aria-expanded="false">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 6H20M4 12H20M4 18H20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </header>
      <div id="mobileNavBackdrop" class="mobile-nav-backdrop hidden"></div>
      <aside id="mobileNavDrawer" class="mobile-nav-drawer">
        <div class="mobile-nav-header">
          <p class="text-sm font-semibold text-blue-300">Menu</p>
          <button id="mobileMenuClose" class="rounded bg-gray-700/50 text-gray-100 px-3 py-2" aria-label="Close menu">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <nav class="mobile-nav-links" aria-label="Mobile primary">
          ${linkHtml}
        </nav>
      </aside>
    `;

    const toggle = this.querySelector("#mobileMenuToggle");
    const close = this.querySelector("#mobileMenuClose");
    const drawer = this.querySelector("#mobileNavDrawer");
    const backdrop = this.querySelector("#mobileNavBackdrop");

    const openMenu = () => {
      drawer.classList.add("open");
      backdrop.classList.remove("hidden");
      toggle.setAttribute("aria-expanded", "true");
      document.body.classList.add("mobile-nav-open");
    };

    const closeMenu = () => {
      drawer.classList.remove("open");
      backdrop.classList.add("hidden");
      toggle.setAttribute("aria-expanded", "false");
      document.body.classList.remove("mobile-nav-open");
    };

    toggle?.addEventListener("click", openMenu);
    close?.addEventListener("click", closeMenu);
    backdrop?.addEventListener("click", closeMenu);
    this.querySelectorAll(".mobile-nav-links a").forEach(link => link.addEventListener("click", closeMenu));
  }
}

customElements.define("custom-navbar", CustomNavbar);
