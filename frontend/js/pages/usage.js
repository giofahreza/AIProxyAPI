// Usage Statistics Page

async function renderUsage(container) {
    try {
        const data = await API.getUsage();

        // Data structure: { failed_requests, usage: { total_requests, success_count, ... } }
        const usage = data.usage || data;

        // Extract statistics
        const totalRequests = usage.total_requests || 0;
        const failedRequests = data.failed_requests || usage.failure_count || 0;
        const successCount = usage.success_count || (totalRequests - failedRequests);
        const successRate = totalRequests > 0 ? ((successCount / totalRequests) * 100).toFixed(1) : '0';

        // Get API/model statistics
        const apiStats = usage.apis || {};
        const modelStats = extractModelStats(apiStats);

        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Usage Statistics</h2>
                    <button class="btn btn-secondary btn-sm" onclick="renderUsage(document.getElementById('pageContent'))">Refresh</button>
                </div>
                <div class="card-body">
                    <div id="usageAlert"></div>

                    <div class="section-header">
                        <h3 class="section-title">Overview</h3>
                    </div>
                    <div class="stats-grid mb-20">
                        <div class="stat-card">
                            <div class="stat-label">Total Requests</div>
                            <div class="stat-value">${formatNumber(totalRequests)}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Successful</div>
                            <div class="stat-value text-success">${formatNumber(successCount)}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Failed</div>
                            <div class="stat-value text-danger">${formatNumber(failedRequests)}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Success Rate</div>
                            <div class="stat-value">${successRate}%</div>
                        </div>
                    </div>

                    ${renderApiStats(apiStats)}

                    ${renderModelStats(modelStats)}

                    <div class="section-header mt-20">
                        <h3 class="section-title">Export & Import</h3>
                        <p class="section-description">Backup or restore your usage statistics</p>
                    </div>
                    <div class="grid-2 mb-20">
                        <div class="oauth-card">
                            <div class="oauth-title">Export Statistics</div>
                            <div class="oauth-description">Download usage data as JSON file</div>
                            <button class="btn btn-block mt-20" onclick="exportUsageData()">Export JSON</button>
                        </div>
                        <div class="oauth-card">
                            <div class="oauth-title">Import Statistics</div>
                            <div class="oauth-description">Restore usage data from a JSON backup file</div>
                            <input type="file" id="usageImportFile" accept=".json" class="mb-20">
                            <button class="btn btn-block" onclick="importUsageData()">Import JSON</button>
                        </div>
                    </div>

                    <div class="section-header mt-20">
                        <h3 class="section-title">Raw Data</h3>
                        <p class="section-description">Full usage statistics object</p>
                    </div>
                    <div class="raw-data-container">
                        <pre class="raw-data">${escapeHtml(JSON.stringify(usage, null, 2))}</pre>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        showError(container, 'Failed to load usage statistics: ' + error.message);
    }
}

function formatNumber(num) {
    if (num === undefined || num === null) return '0';
    return num.toLocaleString();
}

function extractModelStats(apiStats) {
    const models = {};
    for (const apiKey of Object.keys(apiStats)) {
        const apiData = apiStats[apiKey];
        if (apiData.models) {
            for (const modelName of Object.keys(apiData.models)) {
                const modelData = apiData.models[modelName];
                if (!models[modelName]) {
                    models[modelName] = { requests: 0, tokens: 0 };
                }
                models[modelName].requests += modelData.total_requests || 0;
                models[modelName].tokens += modelData.total_tokens || 0;
            }
        }
    }
    return models;
}

function renderApiStats(apiStats) {
    const apiKeys = Object.keys(apiStats);
    if (apiKeys.length === 0) {
        return '';
    }

    let html = `
        <div class="section-header mt-20">
            <h3 class="section-title">By API Key</h3>
        </div>
        <div class="stats-grid mb-20">
    `;

    for (const apiKey of apiKeys) {
        const stats = apiStats[apiKey];
        const requests = stats.total_requests || 0;
        const tokens = stats.total_tokens || 0;
        const displayKey = apiKey.length > 20 ? apiKey.substring(0, 17) + '...' : apiKey;

        html += `
            <div class="stat-card">
                <div class="stat-label">${escapeHtml(displayKey)}</div>
                <div class="stat-value">${formatNumber(requests)}</div>
                <div class="stat-sublabel">${formatNumber(tokens)} tokens</div>
            </div>
        `;
    }

    html += '</div>';
    return html;
}

function renderModelStats(modelStats) {
    const models = Object.keys(modelStats);
    if (models.length === 0) {
        return '';
    }

    // Sort by request count
    const sortedModels = models.sort((a, b) => {
        return (modelStats[b].requests || 0) - (modelStats[a].requests || 0);
    }).slice(0, 10); // Top 10

    let html = `
        <div class="section-header mt-20">
            <h3 class="section-title">Top Models</h3>
            <p class="section-description">Most frequently used models</p>
        </div>
        <div class="usage-table-container">
            <table class="usage-table">
                <thead>
                    <tr>
                        <th>Model</th>
                        <th>Requests</th>
                        <th>Tokens</th>
                    </tr>
                </thead>
                <tbody>
    `;

    for (const model of sortedModels) {
        const stats = modelStats[model];

        html += `
            <tr>
                <td><code>${escapeHtml(model)}</code></td>
                <td>${formatNumber(stats.requests || 0)}</td>
                <td>${formatNumber(stats.tokens || 0)}</td>
            </tr>
        `;
    }

    html += `
                </tbody>
            </table>
        </div>
    `;

    return html;
}

function formatProviderName(provider) {
    const names = {
        'gemini': 'Gemini',
        'claude': 'Claude',
        'codex': 'Codex',
        'vertex': 'Vertex AI',
        'copilot': 'GitHub Copilot',
        'qwen': 'Qwen',
        'aistudio': 'AI Studio',
        'antigravity': 'Antigravity',
        'iflow': 'iFlow'
    };
    return names[provider.toLowerCase()] || provider.charAt(0).toUpperCase() + provider.slice(1);
}

async function exportUsageData() {
    try {
        const data = await API.exportUsage();
        const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        const filename = `usage-export-${new Date().toISOString().split('T')[0]}.json`;
        downloadFile(content, filename, 'application/json');
        showAlert('Usage data exported successfully!', 'success');
    } catch (error) {
        showAlert('Failed to export: ' + error.message, 'error');
    }
}

async function importUsageData() {
    const input = document.getElementById('usageImportFile');
    const alertDiv = document.getElementById('usageAlert');

    if (!input.files || input.files.length === 0) {
        showAlert('Please select a JSON file to import', 'error');
        return;
    }

    const file = input.files[0];

    // Validate file type
    if (!file.name.endsWith('.json')) {
        showAlert('Please select a valid JSON file', 'error');
        return;
    }

    // Confirm import
    if (!confirm('This will merge the imported statistics with existing data. Continue?')) {
        return;
    }

    try {
        alertDiv.innerHTML = '<div class="alert alert-info">Importing usage data...</div>';

        await API.importUsage(file);

        alertDiv.innerHTML = '<div class="alert alert-success">Usage data imported successfully!</div>';
        showAlert('Usage data imported successfully!', 'success');

        // Clear the file input
        input.value = '';

        // Refresh the page after a short delay
        setTimeout(() => {
            renderUsage(document.getElementById('pageContent'));
        }, 1500);
    } catch (error) {
        alertDiv.innerHTML = '';
        showAlert('Failed to import: ' + error.message, 'error');
    }
}
