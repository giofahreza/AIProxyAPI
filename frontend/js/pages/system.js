// System Info Page

async function renderSystem(container) {
    try {
        const config = await API.getConfig();

        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">System Information</h2>
                    <button class="btn" onclick="checkForUpdates()">Check for Updates</button>
                </div>
                <div class="card-body">
                    <div id="systemAlert"></div>

                    <h3>Server Information</h3>
                    <div class="stats-grid mb-20">
                        <div class="stat-card">
                            <div class="stat-label">Server Address</div>
                            <div class="stat-value" style="font-size: 16px;">${API.baseUrl || '-'}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Host:Port</div>
                            <div class="stat-value" style="font-size: 18px;">${escapeHtml(config.host || '0.0.0.0')}:${config.port || 8080}</div>
                        </div>
                    </div>

                    <h3 class="mt-20">Quick Links</h3>
                    <div class="grid-2 mb-20">
                        <a href="https://github.com/router-for-me/CLIProxyAPI" target="_blank" class="btn">
                            Main Repository
                        </a>
                        <a href="https://help.router-for.me/" target="_blank" class="btn">
                            Documentation
                        </a>
                    </div>

                    <h3 class="mt-20">Actions</h3>
                    <button class="btn btn-danger" onclick="clearLoginData()">Clear Login Data</button>
                    <p class="mt-20"><small>This will clear all stored credentials and reload the page</small></p>
                </div>
            </div>
        `;
    } catch (error) {
        showError(container, 'Failed to load system info: ' + error.message);
    }
}

async function checkForUpdates() {
    const alertDiv = document.getElementById('systemAlert');
    try {
        alertDiv.innerHTML = '<div class="alert alert-info">Checking for updates...</div>';
        const data = await API.getLatestVersion();
        const latestVersion = data['latest-version'] || data.latest_version || data.latest || 'Unknown';
        alertDiv.innerHTML = '<div class="alert alert-success">Latest version: ' + escapeHtml(latestVersion) + '</div>';
    } catch (error) {
        alertDiv.innerHTML = '<div class="alert alert-error">Failed to check for updates: ' + escapeHtml(error.message) + '</div>';
    }
}

function clearLoginData() {
    if (!confirm('Are you sure you want to clear all login data? You will need to log in again.')) return;

    localStorage.removeItem('apiBase');
    localStorage.removeItem('token');
    showAlert('Login data cleared. Reloading...', 'success');
    setTimeout(() => window.location.reload(), 1000);
}
