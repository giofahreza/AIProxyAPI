// Usage Statistics Page

async function renderUsage(container) {
    try {
        const usage = await API.getUsage();

        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Usage Statistics</h2>
                    <button class="btn" onclick="exportUsageData()">Export CSV</button>
                </div>
                <div class="card-body">
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-label">Total Requests</div>
                            <div class="stat-value">${usage.total_requests || 0}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Success Rate</div>
                            <div class="stat-value">${calculateSuccessRate(usage)}%</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Failed Requests</div>
                            <div class="stat-value">${usage.failed_requests || 0}</div>
                        </div>
                    </div>

                    <h3 class="mt-20 mb-20">Detailed Statistics</h3>
                    <pre>${JSON.stringify(usage, null, 2)}</pre>
                </div>
            </div>
        `;
    } catch (error) {
        showError(container, 'Failed to load usage statistics: ' + error.message);
    }
}

async function exportUsageData() {
    try {
        const data = await API.exportUsage();
        downloadFile(data, 'usage-export.csv', 'text/csv');
        showAlert('Usage data exported successfully!', 'success');
    } catch (error) {
        showAlert('Failed to export: ' + error.message, 'error');
    }
}
