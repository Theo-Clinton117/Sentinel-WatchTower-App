
// Initialize components and global functionality
document.addEventListener('DOMContentLoaded', function() {
  console.log('NairaGuard ShieldPay initialized');
  
  // Check auth state
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      // User is signed in
      console.log('User signed in:', user);
      // Update UI for logged in user
      const navbar = document.querySelector('custom-navbar');
      if (navbar) {
        navbar.shadowRoot.querySelector('.user-menu').innerHTML = `
          <a href="/dashboard.html" class="text-sm font-medium text-gray-700 hover:text-gray-900">Dashboard</a>
          <button id="logoutBtn" class="ml-4 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
            Logout
          </button>
        `;
        document.getElementById('logoutBtn').addEventListener('click', () => {
          firebase.auth().signOut().then(() => {
            window.location.href = '/';
          });
        });
      }
    } else {
      // User is signed out
      console.log('User signed out');
    }
  });

  // Initialize Firebase if not already initialized
  if (!firebase.apps.length) {
    const firebaseConfig = {
      apiKey: "YOUR_FIREBASE_API_KEY",
      authDomain: "YOUR_FIREBASE_AUTH_DOMAIN",
      projectId: "YOUR_FIREBASE_PROJECT_ID",
      storageBucket: "YOUR_FIREBASE_STORAGE_BUCKET",
      messagingSenderId: "YOUR_FIREBASE_SENDER_ID",
      appId: "YOUR_FIREBASE_APP_ID"
    };
    firebase.initializeApp(firebaseConfig);
  }
});