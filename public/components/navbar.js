class CustomNavbar extends HTMLElement {
  async connectedCallback() {
    const path = window.location.pathname.toLowerCase();
    const authState = await this.getAuthState();
    const authLink = authState.isSignedIn
      ? {
          href: "#",
          label: "Log out",
          match: [],
          isLogout: true,
          icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 17L9 12L14 7" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 12H20" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>`
        }
      : {
          href: "./login.html",
          label: "Sign in",
          match: ["login.html"],
          icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 17L15 12L10 7" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 12H4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M12 3H19a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H12" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>`
        };

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
        href: "./risk-log.html",
        label: "Risk Log",
        match: ["risk-log.html"],
        icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>`
      },
      {
        ...authLink
      }
    ];

    const desktopLinkHtml = links.map(link => {
      const active = link.match.some(m => path.endsWith(m)) || (path === "/" && link.href.includes("home"));
      const activeClass = active ? "bg-blue-600 text-white" : "bg-gray-700/50 text-gray-200 hover:bg-gray-700";
      const authAction = link.isLogout ? ` data-auth-action="logout"` : "";
      return `<a href="${link.href}" class="px-3 py-2 rounded text-xs ${activeClass}" aria-current="${active ? "page" : "false"}"${authAction}>${link.label}</a>`;
    }).join("");

    const mobileLinkHtml = links.map(link => {
      const active = link.match.some(m => path.endsWith(m)) || (path === "/" && link.href.includes("home"));
      const authAction = link.isLogout ? ` data-auth-action="logout"` : "";
      return `
        <a href="${link.href}" class="mobile-nav-item ${active ? "active" : ""}" aria-current="${active ? "page" : "false"}"${authAction}>
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
    const logoutLinks = this.querySelectorAll("[data-auth-action='logout']");
    logoutLinks.forEach(link => {
      link.addEventListener("click", async evt => {
        evt.preventDefault();
        closeMenu();
        await this.logout(authState.supabaseClient);
      });
    });
    document.addEventListener("keydown", evt => {
      if (evt.key === "Escape" && panel.classList.contains("open")) closeMenu();
    });
  }

  async getAuthState() {
    const AUTH_CONTEXT_KEY = "authUserContext";
    const storedContext = sessionStorage.getItem(AUTH_CONTEXT_KEY) || localStorage.getItem(AUTH_CONTEXT_KEY);
    let supabaseClient = null;
    let hasSupabaseSession = false;

    try {
      const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm");
      const SUPABASE_URL = "https://bjmliqvtjjntkgxpwwkp.supabase.co";
      const SUPABASE_ANON_KEY = "sb_publishable_P3c1Q3lJqNyGYobS5wy-EA_xKDOetei";
      supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data } = await supabaseClient.auth.getSession();
      hasSupabaseSession = !!data?.session;
    } catch (_) {
      hasSupabaseSession = false;
    }

    return {
      isSignedIn: hasSupabaseSession || !!storedContext,
      supabaseClient
    };
  }

  async logout(supabaseClient) {
    const AUTH_CONTEXT_KEY = "authUserContext";
    try {
      if (supabaseClient) await supabaseClient.auth.signOut();
    } catch (_) {
      // Continue clearing local auth context even if remote sign-out fails.
    } finally {
      sessionStorage.removeItem(AUTH_CONTEXT_KEY);
      localStorage.removeItem(AUTH_CONTEXT_KEY);
      sessionStorage.removeItem("userEmail");
      localStorage.removeItem("userEmail");
      window.location.href = "./login.html";
    }
  }
}

customElements.define("custom-navbar", CustomNavbar);
