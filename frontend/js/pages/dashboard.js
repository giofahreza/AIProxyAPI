// Dashboard Page

async function renderDashboard(container) {
    try {
        const config = await API.getConfig();
        const usageData = await API.getUsage().catch(() => null);

        // API uses kebab-case keys
        const requestLog = config['request-log'] ?? config.request_log ?? false;

        // Usage API returns { usage: { total_requests, ... } }
        const usage = usageData?.usage || usageData || {};
        const totalRequests = usage.total_requests || 0;

        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">System Overview</h2>
                    <button class="btn btn-sm" onclick="App.refreshConfig()">Refresh</button>
                </div>
                <div class="card-body">
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-label">Server Host</div>
                            <div class="stat-value">${escapeHtml(config.host || '0.0.0.0')}:${config.port || 8080}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Debug Mode</div>
                            <div class="stat-value">${config.debug ? 'ON' : 'OFF'}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Request Logging</div>
                            <div class="stat-value">${requestLog ? 'ON' : 'OFF'}</div>
                        </div>
                        ${usageData ? `
                        <div class="stat-card">
                            <div class="stat-label">Total Requests</div>
                            <div class="stat-value">${totalRequests}</div>
                        </div>
                        ` : ''}
                    </div>

                    <h3 class="mt-20 mb-20">Configuration Summary</h3>
                    <pre>${JSON.stringify(config, null, 2)}</pre>
                </div>
            </div>
        `;
    } catch (error) {
        showError(container, 'Failed to load dashboard: ' + error.message);
    }
}
