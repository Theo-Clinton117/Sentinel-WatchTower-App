class CustomFooter extends HTMLElement {
  connectedCallback() {
    const year = new Date().getFullYear();
    this.innerHTML = `
      <footer class="border-t border-gray-700 bg-gray-900/90">
        <div class="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-3 text-xs text-gray-400">
          <span>© ${year} Sentinel WatchTower</span>
          <div class="flex items-center gap-2">
            <a href="./home.html" class="hover:text-gray-200">Home</a>
            <span>·</span>
            <a href="./dashboard.html" class="hover:text-gray-200">Profile</a>
            <span>·</span>
            <a href="./login.html" class="hover:text-gray-200">Sign in</a>
          </div>
        </div>
      </footer>
    `;
  }
}

customElements.define("custom-footer", CustomFooter);
