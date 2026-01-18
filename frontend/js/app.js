// Main Application Logic

// Application state
const App = {
    currentPage: 'dashboard',
    config: null,

    // Initialize the application
    init() {
        // Check if user is logged in
        const apiBase = localStorage.getItem('apiBase');
        const token = localStorage.getItem('token');

        if (apiBase && token) {
            API.init(apiBase, token);
            this.showMainScreen();
            this.loadConfig();
            this.setupNavigation();
            this.setupLogout();
            this.navigateToHash();
        } else {
            this.showLoginScreen();
            this.setupLogin();
        }

        // Listen to hash changes
        window.addEventListener('hashchange', () => this.navigateToHash());
    },

    // Show login screen
    showLoginScreen() {
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('mainScreen').classList.add('hidden');
    },

    // Show main screen
    showMainScreen() {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('mainScreen').classList.remove('hidden');
    },

    // Setup login form
    setupLogin() {
        const form = document.getElementById('loginForm');
        const errorDiv = document.getElementById('loginError');

        // Pre-fill from localStorage
        const savedApiBase = localStorage.getItem('apiBase') || 'http://localhost:8317';
        document.getElementById('apiBase').value = savedApiBase;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorDiv.classList.add('hidden');

            const apiBase = document.getElementById('apiBase').value.trim();
            const token = document.getElementById('managementKey').value;

            try {
                API.init(apiBase, token);

                // Test the connection
                await API.getConfig();

                this.showMainScreen();
                this.loadConfig();
                this.setupNavigation();
                this.setupLogout();
                this.navigateToHash();
            } catch (error) {
                errorDiv.textContent = 'Login failed: ' + error.message;
                errorDiv.classList.remove('hidden');
            }
        });
    },

    // Setup logout
    setupLogout() {
        document.getElementById('logoutBtn').addEventListener('click', () => {
            if (confirm('Are you sure you want to logout?')) {
                localStorage.removeItem('apiBase');
                localStorage.removeItem('token');
                window.location.reload();
            }
        });
    },

    // Setup navigation
    setupNavigation() {
        // Handle regular nav items
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                this.navigateTo(page);
            });
        });

        // Handle dropdown toggles
        const dropdownToggles = document.querySelectorAll('.nav-dropdown-toggle');
        dropdownToggles.forEach(toggle => {
            toggle.addEventListener('click', () => {
                const dropdown = toggle.parentElement;
                dropdown.classList.toggle('open');
            });
        });
    },

    // Navigate to hash
    navigateToHash() {
        const hash = window.location.hash.slice(1) || 'dashboard';
        this.navigateTo(hash);
    },

    // Navigate to page
    navigateTo(page) {
        this.currentPage = page;
        window.location.hash = page;

        // Update active nav item
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.dataset.page === page) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Update dropdown states
        document.querySelectorAll('.nav-dropdown').forEach(dropdown => {
            const hasActiveChild = dropdown.querySelector('.nav-item.active');
            if (hasActiveChild) {
                dropdown.classList.add('has-active', 'open');
            } else {
                dropdown.classList.remove('has-active');
            }
        });

        // Render page
        this.renderPage(page);
    },

    // Render page
    renderPage(page) {
        const container = document.getElementById('pageContent');
        showLoading(container);

        // Call the appropriate page render function
        switch (page) {
            case 'dashboard':
                renderDashboard(container);
                break;
            case 'settings':
                renderSettings(container);
                break;
            case 'api-keys':
                renderAPIKeys(container);
                break;
            case 'providers':
                renderProviders(container);
                break;
            case 'auth-files':
                renderAuthFiles(container);
                break;
            case 'oauth':
                renderOAuth(container);
                break;
            case 'quota':
                renderQuota(container);
                break;
            case 'usage':
                renderUsage(container);
                break;
            case 'logs':
                renderLogs(container);
                break;
            default:
                container.innerHTML = '<div class="alert alert-error">Page not found</div>';
        }
    },

    // Load and cache config
    async loadConfig() {
        try {
            this.config = await API.getConfig();
            this.updateHeader();
        } catch (error) {
            console.error('Failed to load config:', error);
        }
    },

    // Update header with server info
    updateHeader() {
        const statusBadge = document.getElementById('connectionStatus');
        const serverInfo = document.getElementById('serverInfo');

        statusBadge.textContent = 'Connected';
        statusBadge.className = 'badge badge-success';

        if (this.config) {
            const host = this.config.host || '0.0.0.0';
            const port = this.config.port || 8080;
            serverInfo.textContent = `${host}:${port}`;
        }
    },

    // Refresh config
    async refreshConfig() {
        await this.loadConfig();
        showAlert('Configuration refreshed', 'success');
    }
};

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
} else {
    App.init();
}
