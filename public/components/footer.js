class CustomFooter extends HTMLElement {
  async connectedCallback() {
    const year = new Date().getFullYear();
    const authState = await this.getAuthState();
    const authLabel = authState.isSignedIn ? "Log out" : "Sign in";
    const authHref = authState.isSignedIn ? "#" : "./login.html";
    const authAction = authState.isSignedIn ? ` data-auth-action="logout"` : "";

    this.innerHTML = `
      <footer class="border-t border-gray-700 bg-gray-900/90">
        <div class="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-3 text-xs text-gray-400">
          <span>© ${year} Sentinel WatchTower</span>
          <div class="flex items-center gap-2">
            <a href="./home.html" class="hover:text-gray-200">Home</a>
            <span>·</span>
            <a href="./dashboard.html" class="hover:text-gray-200">Profile</a>
            <span>·</span>
            <a href="./risk-log.html" class="hover:text-gray-200">Risk Log</a>
            <span>·</span>
            <a href="${authHref}" class="hover:text-gray-200"${authAction}>${authLabel}</a>
          </div>
        </div>
      </footer>
    `;

    const logoutLink = this.querySelector("[data-auth-action='logout']");
    if (logoutLink) {
      logoutLink.addEventListener("click", async evt => {
        evt.preventDefault();
        await this.logout(authState.supabaseClient);
      });
    }
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

customElements.define("custom-footer", CustomFooter);
