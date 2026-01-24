// Dashboard Page

async function renderDashboard(container) {
    try {
        // Fetch all data in parallel
        const [config, usageData, versionInfo, models] = await Promise.all([
            API.getConfig(),
            API.getUsage().catch(() => null),
            API.getServerVersion(),
            API.getAvailableModels()
        ]);

        // API uses kebab-case keys
        const requestLog = config['request-log'] ?? config.request_log ?? false;
        const usageStats = config['usage-statistics-enabled'] ?? config.usage_statistics_enabled ?? false;

        // Usage API returns { usage: { total_requests, ... } }
        const usage = usageData?.usage || usageData || {};
        const totalRequests = usage.total_requests || 0;

        // Version info
        const serverVersion = versionInfo.version || 'unknown';

        // Group models by provider
        const groupedModels = groupModelsByProvider(models);

        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">System Overview</h2>
                    <button class="btn btn-secondary btn-sm" onclick="renderDashboard(document.getElementById('pageContent'))">Refresh</button>
                </div>
                <div class="card-body">
                    <div id="dashboardAlert"></div>

                    <div class="section-header">
                        <h3 class="section-title">Server Status</h3>
                    </div>
                    <div class="stats-grid mb-20">
                        <div class="stat-card">
                            <div class="stat-label">Server Address</div>
                            <div class="stat-value" style="font-size: 16px;">${escapeHtml(API.baseUrl || '-')}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Host:Port</div>
                            <div class="stat-value" style="font-size: 18px;">${escapeHtml(config.host || '0.0.0.0')}:${config.port || 8080}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Current Version</div>
                            <div class="stat-value" style="font-size: 18px;">${escapeHtml(serverVersion)}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Latest Version</div>
                            <div class="stat-value" id="latestVersionDisplay" style="font-size: 18px;">
                                <span class="text-muted">Click to check</span>
                            </div>
                            <button class="btn btn-secondary btn-sm mt-20" onclick="checkForUpdates('${escapeHtml(serverVersion)}')">Check Updates</button>
                        </div>
                    </div>

                    <div class="section-header">
                        <h3 class="section-title">Quick Stats</h3>
                    </div>
                    <div class="stats-grid mb-20">
                        <div class="stat-card">
                            <div class="stat-label">Debug Mode</div>
                            <div class="stat-value">${config.debug ? '<span class="badge badge-warning">Enabled</span>' : '<span class="badge badge-secondary">Disabled</span>'}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Request Logging</div>
                            <div class="stat-value">${requestLog ? '<span class="badge badge-success">Enabled</span>' : '<span class="badge badge-secondary">Disabled</span>'}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Usage Statistics</div>
                            <div class="stat-value">${usageStats ? '<span class="badge badge-success">Enabled</span>' : '<span class="badge badge-secondary">Disabled</span>'}</div>
                        </div>
                        ${usageData ? `
                        <div class="stat-card">
                            <div class="stat-label">Total Requests</div>
                            <div class="stat-value">${totalRequests}</div>
                        </div>
                        ` : ''}
                    </div>

                    <div class="section-header">
                        <h3 class="section-title">Available Models (${models.length})</h3>
                        <p class="section-description">Models registered in the system grouped by provider</p>
                    </div>
                    ${renderModelsSection(groupedModels)}

                    <div class="section-header mt-20">
                        <h3 class="section-title">Quick Links</h3>
                    </div>
                    <div class="grid-2 mb-20">
                        <a href="https://github.com/giofahreza/AIProxyAPI" target="_blank" class="btn">
                            Main Repository
                        </a>
                        <a href="https://help.router-for.me/" target="_blank" class="btn">
                            Documentation
                        </a>
                    </div>

                    <div class="section-header mt-20">
                        <h3 class="section-title">Actions</h3>
                    </div>
                    <button class="btn btn-danger" onclick="clearLoginData()">Clear Login Data</button>
                    <p class="mt-20"><small class="text-muted">This will clear all stored credentials and reload the page</small></p>
                </div>
            </div>
        `;
    } catch (error) {
        showError(container, 'Failed to load dashboard: ' + error.message);
    }
}

function groupModelsByProvider(models) {
    const groups = {};

    for (const model of models) {
        // Determine provider from model type, id, or owned_by
        let provider = model.type || model.owned_by || 'other';

        // Normalize provider names
        if (provider.includes('gemini') || provider.includes('google')) {
            provider = 'gemini';
        } else if (provider.includes('claude') || provider.includes('anthropic')) {
            provider = 'claude';
        } else if (provider.includes('codex') || provider.includes('openai')) {
            provider = 'codex';
        } else if (provider.includes('vertex')) {
            provider = 'vertex';
        } else if (provider.includes('qwen')) {
            provider = 'qwen';
        } else if (provider.includes('copilot') || provider.includes('github')) {
            provider = 'copilot';
        } else if (provider.includes('aistudio')) {
            provider = 'aistudio';
        } else if (provider.includes('antigravity')) {
            provider = 'antigravity';
        } else if (provider.includes('iflow')) {
            provider = 'iflow';
        }

        if (!groups[provider]) {
            groups[provider] = [];
        }
        groups[provider].push(model);
    }

    return groups;
}

function renderModelsSection(groupedModels) {
    const providerOrder = ['gemini', 'claude', 'codex', 'vertex', 'copilot', 'qwen', 'aistudio', 'antigravity', 'iflow', 'other'];
    const providerLabels = {
        gemini: 'Gemini',
        claude: 'Claude (Anthropic)',
        codex: 'Codex (OpenAI)',
        vertex: 'Vertex AI',
        copilot: 'GitHub Copilot',
        qwen: 'Qwen',
        aistudio: 'AI Studio',
        antigravity: 'Antigravity',
        iflow: 'iFlow',
        other: 'Other'
    };

    const providers = Object.keys(groupedModels);
    if (providers.length === 0) {
        return `
            <div class="empty-state">
                <div class="empty-state-title">No models available</div>
                <div class="empty-state-description">Add authentication credentials to see available models</div>
            </div>
        `;
    }

    // Sort providers by predefined order
    providers.sort((a, b) => {
        const aIndex = providerOrder.indexOf(a);
        const bIndex = providerOrder.indexOf(b);
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });

    let html = '<div class="models-by-provider">';

    for (const provider of providers) {
        const models = groupedModels[provider];
        const label = providerLabels[provider] || provider.charAt(0).toUpperCase() + provider.slice(1);

        html += `
            <div class="provider-models-section">
                <div class="provider-header" onclick="toggleModelsSection('${provider}')">
                    <span class="provider-name">${escapeHtml(label)}</span>
                    <span class="provider-count">${models.length} model${models.length !== 1 ? 's' : ''}</span>
                    <span class="provider-toggle" id="toggle-${provider}">▼</span>
                </div>
                <div class="provider-models" id="models-${provider}">
                    <div class="models-grid">
                        ${models.map(m => `
                            <div class="model-tag" onclick="copyModelId('${escapeHtml(m.id || m.name || '')}')">
                                ${escapeHtml(m.display_name || m.id || m.name || 'Unknown')}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    html += '</div>';
    return html;
}

function toggleModelsSection(provider) {
    const section = document.getElementById(`models-${provider}`);
    const toggle = document.getElementById(`toggle-${provider}`);

    if (section.classList.contains('collapsed')) {
        section.classList.remove('collapsed');
        toggle.textContent = '▼';
    } else {
        section.classList.add('collapsed');
        toggle.textContent = '▶';
    }
}

function copyModelId(modelId) {
    if (!modelId) return;
    navigator.clipboard.writeText(modelId);
    showAlert('Model ID copied: ' + modelId, 'success');
}

async function checkForUpdates(currentVersion) {
    const displayEl = document.getElementById('latestVersionDisplay');
    const alertDiv = document.getElementById('dashboardAlert');

    try {
        displayEl.innerHTML = '<span class="text-muted">Checking...</span>';
        const data = await API.getLatestVersion();
        const latestVersion = data['latest-version'] || data.latest_version || data.latest || 'Unknown';

        // Compare versions
        const current = currentVersion.replace(/^v/, '');
        const latest = latestVersion.replace(/^v/, '');

        let versionClass = '';
        let versionStatus = '';

        if (current === 'dev' || current === 'unknown') {
            versionClass = 'text-muted';
            versionStatus = ' (dev build)';
        } else if (current === latest) {
            versionClass = 'text-success';
            versionStatus = ' (up to date)';
        } else if (compareVersions(current, latest) < 0) {
            versionClass = 'text-warning';
            versionStatus = ' (update available)';
        } else {
            versionClass = 'text-info';
            versionStatus = ' (newer than release)';
        }

        displayEl.innerHTML = `<span class="${versionClass}">${escapeHtml(latestVersion)}${versionStatus}</span>`;

        if (versionStatus.includes('update available') && alertDiv) {
            alertDiv.innerHTML = `
                <div class="alert alert-info">
                    A new version (${escapeHtml(latestVersion)}) is available!
                    <a href="https://github.com/giofahreza/AIProxyAPI/releases/latest" target="_blank">View release</a>
                </div>
            `;
        }
    } catch (error) {
        displayEl.innerHTML = '<span class="text-danger">Failed to check</span>';
        if (alertDiv) {
            alertDiv.innerHTML = '<div class="alert alert-error">Failed to check for updates: ' + escapeHtml(error.message) + '</div>';
        }
    }
}

function compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(p => parseInt(p, 10) || 0);
    const parts2 = v2.split('.').map(p => parseInt(p, 10) || 0);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 < p2) return -1;
        if (p1 > p2) return 1;
    }
    return 0;
}

function clearLoginData() {
    if (!confirm('Are you sure you want to clear all login data? You will need to log in again.')) return;

    localStorage.removeItem('apiBase');
    localStorage.removeItem('token');
    showAlert('Login data cleared. Reloading...', 'success');
    setTimeout(() => window.location.reload(), 1000);
}
