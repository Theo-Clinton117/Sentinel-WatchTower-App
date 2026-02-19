class CustomNavbar extends HTMLElement {
  connectedCallback() {
    const path = window.location.pathname.toLowerCase();
    const links = [
      {
        href: "./home.html",
        label: "Home",
        match: ["home.html", "/"],
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 10.5L12 3L21 10.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5Z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>`
      },
      {
        href: "./dashboard.html",
        label: "Account",
        match: ["dashboard.html", "reviewer-dashboard.html", "admin-dashboard.html"],
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>`
      },
      {
        href: "./login.html",
        label: "Sign in",
        match: ["login.html"],
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 17L15 12L10 7" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 12H4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M12 3H19a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H12" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>`
      }
    ];

    const desktopLinkHtml = links.map(link => {
      const active = link.match.some(m => path.endsWith(m)) || (path === "/" && link.href.includes("home"));
      const activeClass = active ? "bg-blue-600 text-white" : "bg-gray-700/50 text-gray-200 hover:bg-gray-700";
      return `<a href="${link.href}" class="px-3 py-2 rounded text-xs ${activeClass}" aria-current="${active ? "page" : "false"}">${link.label}</a>`;
    }).join("");

    const mobileLinkHtml = links.map(link => {
      const active = link.match.some(m => path.endsWith(m)) || (path === "/" && link.href.includes("home"));
      return `
        <a href="${link.href}" class="mobile-nav-item ${active ? "active" : ""}" aria-current="${active ? "page" : "false"}">
          <span class="mobile-nav-item-icon">${link.icon}</span>
          <span>${link.label}</span>
        </a>
      `;
    }).join("");

    this.innerHTML = `
      <header class="fixed top-0 inset-x-0 z-50 border-b border-gray-700 bg-gray-900/90 backdrop-blur-sm">
        <div class="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-3">
          <a href="./home.html" class="flex items-center gap-2 text-sm font-semibold text-blue-300">
            <span class="w-2 h-2 rounded-full bg-red-500"></span>
            Sentinel WatchTower
          </a>
          <nav class="nav-desktop flex items-center gap-2" aria-label="Primary">
            ${desktopLinkHtml}
          </nav>
          <button id="mobileMenuToggle" class="nav-mobile-toggle rounded bg-gray-700/50 text-gray-100 px-3 py-2" aria-label="Open menu" aria-expanded="false" aria-controls="mobileNavPanel">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 6H20M4 12H20M4 18H20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </header>
      <div id="mobileNavBackdrop" class="mobile-nav-backdrop hidden"></div>
      <aside id="mobileNavPanel" class="mobile-nav-panel" aria-hidden="true">
        <nav class="mobile-nav-links" aria-label="Mobile primary">
          ${mobileLinkHtml}
        </nav>
      </aside>
    `;

    const toggle = this.querySelector("#mobileMenuToggle");
    const panel = this.querySelector("#mobileNavPanel");
    const backdrop = this.querySelector("#mobileNavBackdrop");

    const menuIcon = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 6H20M4 12H20M4 18H20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;
    const closeIcon = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;

    const openMenu = () => {
      panel.classList.add("open");
      backdrop.classList.remove("hidden");
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", "Close menu");
      toggle.innerHTML = closeIcon;
      panel.setAttribute("aria-hidden", "false");
      document.body.classList.add("mobile-nav-open");
    };

    const closeMenu = () => {
      panel.classList.remove("open");
      backdrop.classList.add("hidden");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open menu");
      toggle.innerHTML = menuIcon;
      panel.setAttribute("aria-hidden", "true");
      document.body.classList.remove("mobile-nav-open");
    };

    toggle?.addEventListener("click", () => {
      if (panel.classList.contains("open")) closeMenu();
      else openMenu();
    });
    backdrop?.addEventListener("click", closeMenu);
    this.querySelectorAll(".mobile-nav-links a").forEach(link => link.addEventListener("click", closeMenu));
    document.addEventListener("keydown", evt => {
      if (evt.key === "Escape" && panel.classList.contains("open")) closeMenu();
    });
  }
}

customElements.define("custom-navbar", CustomNavbar);
