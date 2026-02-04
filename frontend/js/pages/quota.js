// Quota Management Page

async function renderQuota(container) {
    try {
        const config = await API.getConfig();
        const quotaExceeded = config['quota-exceeded'] || config.quota_exceeded || {};
        const switchProject = quotaExceeded['switch-project'] ?? quotaExceeded.switch_project ?? false;
        const switchPreviewModel = quotaExceeded['switch-preview-model'] ?? quotaExceeded.switch_preview_model ?? false;

        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Quota Management</h2>
                    <button class="btn-refresh" onclick="renderQuota(document.getElementById('pageContent'))">Refresh All</button>
                </div>
                <div class="card-body">
                    <div id="quotaAlert"></div>

                    <h3>Quota Exceeded Behavior</h3>

                    <div class="form-group">
                        <label class="toggle">
                            <input type="checkbox" id="switchProject" ${switchProject ? 'checked' : ''}>
                            <span>Switch Project on Quota Exceeded</span>
                        </label>
                        <small>Automatically switch to another project when quota is exceeded</small>
                    </div>

                    <div class="form-group">
                        <label class="toggle">
                            <input type="checkbox" id="switchPreviewModel" ${switchPreviewModel ? 'checked' : ''}>
                            <span>Switch to Preview Model on Quota Exceeded</span>
                        </label>
                        <small>Automatically switch to preview model when quota is exceeded</small>
                    </div>

                    <button class="btn btn-success" onclick="saveQuotaSettings()">Save Settings</button>

                    <hr style="margin: 30px 0;">

                    <div id="quotaCredentials">
                        <div class="flex-between mb-20">
                            <h3>Provider Quota Status</h3>
                            <button class="btn-refresh" onclick="loadQuotaCredentials()">Refresh Quota</button>
                        </div>
                        <div id="quotaCredentialsList">
                            <div class="loading"><div class="spinner"></div><p>Loading credentials...</p></div>
                        </div>
                    </div>

                    <hr style="margin: 30px 0;">

                    <h3>OAuth Excluded Models</h3>
                    <p>Models excluded from OAuth authentication (supports wildcards: *, prefix*, *suffix, *substring*)</p>
                    <textarea id="oauthExcludedModels" rows="5" placeholder="gemini-2.5-pro&#10;*-preview&#10;claude-*"></textarea>
                    <button class="btn btn-success mt-20" onclick="saveOAuthExcludedModels()">Save Excluded Models</button>

                    <hr style="margin: 30px 0;">

                    <h3>OAuth Model Mappings</h3>
                    <p>Map upstream models to local model names (JSON format)</p>
                    <textarea id="oauthModelMappings" rows="8" placeholder='[{"from": "upstream-model", "to": "local-model"}]'></textarea>
                    <button class="btn btn-success mt-20" onclick="saveOAuthModelMappings()">Save Model Mappings</button>
                </div>
            </div>
        `;

        // Load OAuth excluded models
        try {
            const excluded = await API.getOAuthExcludedModels();
            const models = excluded['oauth-excluded-models'] || excluded.oauthExcludedModels || excluded || [];
            document.getElementById('oauthExcludedModels').value = Array.isArray(models) ? models.join('\n') : '';
        } catch (error) {
            console.error('Failed to load excluded models:', error);
        }

        // Load OAuth model mappings
        try {
            const mappings = await API.getOAuthModelMappings();
            const data = mappings['oauth-model-mappings'] || mappings.oauthModelMappings || mappings || [];
            document.getElementById('oauthModelMappings').value = JSON.stringify(data, null, 2);
        } catch (error) {
            console.error('Failed to load model mappings:', error);
        }

        // Setup toggle event listeners
        document.getElementById('switchProject').addEventListener('change', async (e) => {
            try {
                await API.updateSwitchProject(e.target.checked);
                showAlert('Setting updated', 'success');
            } catch (error) {
                showAlert('Failed to update: ' + error.message, 'error');
            }
        });

        document.getElementById('switchPreviewModel').addEventListener('change', async (e) => {
            try {
                await API.updateSwitchPreviewModel(e.target.checked);
                showAlert('Setting updated', 'success');
            } catch (error) {
                showAlert('Failed to update: ' + error.message, 'error');
            }
        });

        // Load credentials and quota
        loadQuotaCredentials();

    } catch (error) {
        showError(container, 'Failed to load quota settings: ' + error.message);
    }
}

async function loadQuotaCredentials() {
    const listEl = document.getElementById('quotaCredentialsList');
    if (!listEl) return;

    listEl.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading credentials...</p></div>';

    try {
        const authFiles = await API.listAuthFiles();
        const files = authFiles.files || authFiles['auth-files'] || authFiles.authFiles || authFiles || [];

        if (!Array.isArray(files) || files.length === 0) {
            listEl.innerHTML = '<div class="empty-state"><p class="text-muted">No auth credentials found. Add credentials via the OAuth page.</p></div>';
            return;
        }

        // Group by provider type
        const groups = {};
        for (const file of files) {
            const type = file.type || 'unknown';
            if (!groups[type]) groups[type] = [];
            groups[type].push(file);
        }

        let html = '';
        const providerOrder = ['codex', 'gemini-cli', 'antigravity', 'claude', 'copilot', 'qwen', 'iflow'];
        const sortedTypes = Object.keys(groups).sort((a, b) => {
            const ai = providerOrder.indexOf(a);
            const bi = providerOrder.indexOf(b);
            return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
        });

        for (const type of sortedTypes) {
            const creds = groups[type];
            const typeLabel = getProviderLabel(type);
            const hasQuota = ['codex', 'gemini-cli', 'antigravity', 'claude', 'copilot'].includes(type);

            html += `<div class="quota-section-group">`;
            html += `<div class="quota-section-group-title">
                <span class="file-type ${type}">${type}</span>
                ${typeLabel} (${creds.length} credential${creds.length > 1 ? 's' : ''})
            </div>`;

            for (const cred of creds) {
                const authIndex = cred.auth_index || cred.authIndex || '';
                const cardId = `quota-card-${authIndex.replace(/[^a-zA-Z0-9]/g, '_')}`;
                const displayName = cred.email || cred.name || authIndex;

                html += `<div class="quota-credential-card" id="${cardId}">`;
                html += `<div class="quota-credential-header">`;
                html += `<div class="quota-credential-title">
                    <span>${escapeHtml(displayName)}</span>
                    <span class="badge badge-sm">${escapeHtml(authIndex)}</span>
                </div>`;
                if (hasQuota) {
                    html += `<button class="btn-refresh" onclick="refreshSingleQuota('${escapeHtml(authIndex)}', '${type}', '${cardId}')">Refresh</button>`;
                }
                html += `</div>`;
                html += `<div class="quota-credential-body" id="${cardId}-body">`;
                if (hasQuota) {
                    html += `<div class="quota-credential-loading"><div class="spinner-sm"></div>Loading quota...</div>`;
                } else {
                    html += `<div class="text-muted" style="font-size:13px;">Quota tracking not available for this provider type.</div>`;
                }
                html += `</div></div>`;
            }
            html += `</div>`;
        }

        listEl.innerHTML = html;

        // Fetch quota for supported providers
        for (const type of sortedTypes) {
            if (!['codex', 'gemini-cli', 'antigravity', 'claude', 'copilot'].includes(type)) continue;
            for (const cred of groups[type]) {
                const authIndex = cred.auth_index || cred.authIndex || '';
                const cardId = `quota-card-${authIndex.replace(/[^a-zA-Z0-9]/g, '_')}`;
                fetchAndRenderQuota(authIndex, type, cardId, cred);
            }
        }

    } catch (error) {
        listEl.innerHTML = `<div class="alert alert-error">Failed to load credentials: ${escapeHtml(error.message)}</div>`;
    }
}

function getProviderLabel(type) {
    const labels = {
        'codex': 'Codex (ChatGPT)',
        'gemini-cli': 'Gemini CLI',
        'antigravity': 'Antigravity',
        'claude': 'Claude',
        'copilot': 'Copilot',
        'qwen': 'Qwen',
        'iflow': 'iFlow'
    };
    return labels[type] || type;
}

async function refreshSingleQuota(authIndex, type, cardId) {
    const bodyEl = document.getElementById(cardId + '-body');
    if (!bodyEl) return;
    bodyEl.innerHTML = '<div class="quota-credential-loading"><div class="spinner-sm"></div>Loading quota...</div>';
    await fetchAndRenderQuota(authIndex, type, cardId);
}

async function fetchAndRenderQuota(authIndex, type, cardId, cred) {
    const bodyEl = document.getElementById(cardId + '-body');
    if (!bodyEl) return;

    try {
        let html = '';
        if (type === 'codex') {
            html = await renderCodexQuota(authIndex, cred);
        } else if (type === 'gemini-cli') {
            html = await renderGeminiCliQuota(authIndex, cred);
        } else if (type === 'antigravity') {
            html = await renderAntigravityQuota(authIndex, cred);
        } else if (type === 'claude') {
            html = await renderClaudeQuota(authIndex, cred);
        } else if (type === 'copilot') {
            html = await renderCopilotQuota(authIndex, cred);
        }
        bodyEl.innerHTML = html || '<div class="text-muted" style="font-size:13px;">No quota data available.</div>';
    } catch (error) {
        bodyEl.innerHTML = `<div class="quota-credential-error">Failed to load quota: ${escapeHtml(error.message)}</div>`;
    }
}

// === Codex Quota ===
async function renderCodexQuota(authIndex, cred) {
    const headers = {
        'Authorization': 'Bearer $TOKEN$'
    };
    // Add chatgpt_account_id if available
    const accountId = cred?.chatgpt_account_id || cred?.chatgptAccountId
        || cred?.id_token?.chatgpt_account_id || cred?.id_token?.chatgptAccountId;
    if (accountId) {
        headers['Chatgpt-Account-Id'] = accountId;
    }

    const resp = await API.apiCall({
        auth_index: authIndex,
        method: 'GET',
        url: 'https://chatgpt.com/backend-api/wham/usage',
        header: headers
    });

    const statusCode = resp.status_code || resp.statusCode;
    if (statusCode && statusCode !== 200) {
        return `<div class="quota-credential-error">API returned status ${statusCode}</div>`;
    }

    let data;
    try {
        data = typeof resp.body === 'string' ? JSON.parse(resp.body) : resp.body;
    } catch {
        return `<div class="quota-credential-error">Failed to parse quota response</div>`;
    }

    if (!data) {
        return '<div class="text-muted" style="font-size:13px;">No quota data returned.</div>';
    }

    let html = '';

    // Rate limit (code generation)
    if (data.rate_limit) {
        html += renderCodexRateLimitSection('Code Generation', data.rate_limit);
    }

    // Code review rate limit
    if (data.code_review_rate_limit) {
        html += renderCodexRateLimitSection('Code Review', data.code_review_rate_limit);
    }

    return html || '<div class="text-muted" style="font-size:13px;">No rate limit data in response.</div>';
}

function renderCodexRateLimitSection(title, rateLimit) {
    let html = `<div style="margin-bottom:12px;"><strong style="color:var(--text-primary);font-size:13px;">${escapeHtml(title)}</strong></div>`;

    const windows = rateLimit.windows || [];
    for (const w of windows) {
        const usedPct = (w.used_percent || 0) * 100;
        const resetTime = w.reset_time ? formatResetTime(w.reset_time) : '';
        const windowLabel = formatWindowDuration(w.window_duration_seconds || w.duration_seconds || 0);

        html += renderProgressBar(
            `${windowLabel} window`,
            usedPct,
            resetTime ? `Resets ${resetTime}` : ''
        );
    }

    return html;
}

function formatWindowDuration(seconds) {
    if (!seconds) return 'Unknown';
    const hours = seconds / 3600;
    if (hours >= 24) {
        const days = Math.floor(hours / 24);
        return days === 7 ? 'Weekly' : `${days}-day`;
    }
    return `${Math.round(hours)}-hour`;
}

function formatResetTime(resetTime) {
    if (!resetTime) return '';
    try {
        const date = new Date(resetTime);
        const now = new Date();
        const diffMs = date - now;
        if (diffMs <= 0) return 'now';
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 60) return `in ${diffMins}m`;
        const diffHours = Math.floor(diffMins / 60);
        const remainMins = diffMins % 60;
        if (diffHours < 24) return `in ${diffHours}h ${remainMins}m`;
        const diffDays = Math.floor(diffHours / 24);
        return `in ${diffDays}d ${diffHours % 24}h`;
    } catch {
        return '';
    }
}

// === Gemini CLI Quota ===
async function renderGeminiCliQuota(authIndex, cred) {
    const projectId = cred?.project_id || cred?.projectId || '';
    const body = projectId ? JSON.stringify({ project: projectId }) : '{}';

    const resp = await API.apiCall({
        auth_index: authIndex,
        method: 'POST',
        url: 'https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota',
        header: {
            'Authorization': 'Bearer $TOKEN$',
            'Content-Type': 'application/json'
        },
        data: body
    });

    const statusCode = resp.status_code || resp.statusCode;
    if (statusCode && statusCode !== 200) {
        return `<div class="quota-credential-error">API returned status ${statusCode}</div>`;
    }

    let data;
    try {
        data = typeof resp.body === 'string' ? JSON.parse(resp.body) : resp.body;
    } catch {
        return `<div class="quota-credential-error">Failed to parse quota response</div>`;
    }

    if (!data || !data.buckets || data.buckets.length === 0) {
        return '<div class="text-muted" style="font-size:13px;">No quota buckets returned.</div>';
    }

    // Group buckets by model
    const modelBuckets = {};
    for (const bucket of data.buckets) {
        const modelId = bucket.modelId || bucket.model_id || 'unknown';
        if (!modelBuckets[modelId]) modelBuckets[modelId] = [];
        modelBuckets[modelId].push(bucket);
    }

    let html = '';
    for (const [modelId, buckets] of Object.entries(modelBuckets)) {
        html += `<div style="margin-bottom:12px;"><strong style="color:var(--text-primary);font-size:13px;">${escapeHtml(modelId)}</strong></div>`;

        for (const bucket of buckets) {
            const remaining = bucket.remainingFraction ?? bucket.remaining_fraction ?? 1;
            const usedPct = (1 - remaining) * 100;
            const tokenType = bucket.tokenType || bucket.token_type || '';
            const resetTime = bucket.resetTime || bucket.reset_time;
            const remainingAmount = bucket.remainingAmount || bucket.remaining_amount;

            let detail = '';
            if (remainingAmount !== undefined && remainingAmount !== null) {
                detail = `${remainingAmount} remaining`;
            }
            if (resetTime) {
                const resetStr = formatResetTime(resetTime);
                detail += detail ? ` | Resets ${resetStr}` : `Resets ${resetStr}`;
            }

            html += renderProgressBar(
                tokenType || 'Quota',
                usedPct,
                detail
            );
        }
    }

    return html;
}

// === Antigravity Quota ===
async function renderAntigravityQuota(authIndex, cred) {
    const projectId = cred?.project_id || cred?.projectId || '';
    const body = projectId ? JSON.stringify({ project: projectId }) : '{}';

    // Try primary URL first, fallback if needed
    const urls = [
        'https://daily-cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels',
        'https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels'
    ];

    let resp = null;
    let lastError = null;
    for (const url of urls) {
        try {
            resp = await API.apiCall({
                auth_index: authIndex,
                method: 'POST',
                url: url,
                header: {
                    'Authorization': 'Bearer $TOKEN$',
                    'Content-Type': 'application/json'
                },
                data: body
            });
            const sc = resp.status_code || resp.statusCode;
            if (!sc || sc === 200) break;
            lastError = `Status ${sc}`;
            resp = null;
        } catch (e) {
            lastError = e.message;
            resp = null;
        }
    }

    if (!resp) {
        return `<div class="quota-credential-error">Failed to fetch available models: ${escapeHtml(lastError || 'Unknown error')}</div>`;
    }

    let data;
    try {
        data = typeof resp.body === 'string' ? JSON.parse(resp.body) : resp.body;
    } catch {
        return `<div class="quota-credential-error">Failed to parse response</div>`;
    }

    if (!data || !data.models) {
        return '<div class="text-muted" style="font-size:13px;">No model data returned.</div>';
    }

    let html = '<div style="margin-bottom:8px;"><strong style="color:var(--text-primary);font-size:13px;">Available Models</strong></div>';
    html += '<div class="quota-model-list">';

    const models = data.models;
    if (typeof models === 'object' && !Array.isArray(models)) {
        // models is an object with model names as keys
        for (const [modelName, modelInfo] of Object.entries(models)) {
            const available = modelInfo?.available !== false;
            html += `<div class="quota-model-item ${available ? 'available' : 'unavailable'}">${escapeHtml(modelName)}</div>`;
        }
    } else if (Array.isArray(models)) {
        for (const model of models) {
            const name = typeof model === 'string' ? model : (model.name || model.id || 'unknown');
            const available = typeof model === 'string' ? true : (model.available !== false);
            html += `<div class="quota-model-item ${available ? 'available' : 'unavailable'}">${escapeHtml(name)}</div>`;
        }
    }

    html += '</div>';
    return html;
}

// === Claude Quota ===
async function renderClaudeQuota(authIndex, cred) {
    try {
        const resp = await API.apiCall({
            auth_index: authIndex,
            method: 'GET',
            url: 'https://api.anthropic.com/api/oauth/usage',
            header: {
                'Authorization': 'Bearer $TOKEN$',
                'Anthropic-Version': '2023-06-01',
                'Anthropic-Beta': 'claude-code-20250219,oauth-2025-04-20',
                'Anthropic-Dangerous-Direct-Browser-Access': 'true',
                'X-App': 'cli'
            }
        });

        const statusCode = resp.status_code || resp.statusCode;
        if (statusCode && statusCode !== 200) {
            const hint = statusCode === 401
                ? 'Token may be expired - try re-authenticating via OAuth page'
                : statusCode === 403
                    ? 'OAuth token may be missing user:profile scope'
                    : '';
            return `<div class="quota-credential-error">API returned status ${statusCode}${hint ? ' (' + hint + ')' : ''}</div>`;
        }

        let data;
        try {
            data = typeof resp.body === 'string' ? JSON.parse(resp.body) : resp.body;
        } catch {
            return `<div class="quota-credential-error">Failed to parse usage response</div>`;
        }

        if (!data) {
            return '<div class="text-muted" style="font-size:13px;">No usage data returned.</div>';
        }

        let html = '';

        // Five-hour window
        const fiveHour = data.five_hour || data.fiveHour;
        if (fiveHour) {
            const utilization = fiveHour.utilization ?? fiveHour.used_percent ?? null;
            if (utilization !== null) {
                const usedPct = utilization * 100;
                const resetTime = fiveHour.reset_time || fiveHour.resetTime;
                html += renderProgressBar(
                    '5-Hour Window',
                    usedPct,
                    resetTime ? `Resets ${formatResetTime(resetTime)}` : ''
                );
            }
        }

        // Seven-day / weekly window
        const sevenDay = data.seven_day || data.sevenDay || data.weekly;
        if (sevenDay) {
            const utilization = sevenDay.utilization ?? sevenDay.used_percent ?? null;
            if (utilization !== null) {
                const usedPct = utilization * 100;
                const resetTime = sevenDay.reset_time || sevenDay.resetTime;
                html += renderProgressBar(
                    'Weekly Window',
                    usedPct,
                    resetTime ? `Resets ${formatResetTime(resetTime)}` : ''
                );
            }
        }

        // If we got data but no recognized windows, show raw info
        if (!html && data) {
            html = '<div class="text-muted" style="font-size:13px;">Usage data received but no rate limit windows found.</div>';
        }

        return html;
    } catch (error) {
        return `<div class="quota-credential-error">Failed to fetch usage: ${escapeHtml(error.message)}</div>`;
    }
}

// === Copilot Info ===
async function renderCopilotQuota(authIndex, cred) {
    // No public quota API exists for GitHub Copilot individual users.
    // Display available token metadata from the credential.
    let html = '';

    const sku = cred?.sku || cred?.plan;
    const email = cred?.email;
    const expireRaw = cred?.copilot_expire || cred?.copilotExpire;
    const lastRefresh = cred?.last_refresh || cred?.lastRefresh;

    const items = [];

    if (sku) {
        items.push(`<strong>Plan:</strong> ${escapeHtml(sku)}`);
    }
    if (email) {
        items.push(`<strong>Account:</strong> ${escapeHtml(email)}`);
    }
    if (expireRaw) {
        const expireDate = new Date(typeof expireRaw === 'number' ? expireRaw * 1000 : expireRaw);
        const now = new Date();
        const isExpired = expireDate <= now;
        const timeStr = isExpired ? 'Expired' : formatResetTime(expireDate.toISOString());
        const statusClass = isExpired ? 'text-danger' : 'text-success';
        items.push(`<strong>Token Expires:</strong> <span class="${statusClass}">${escapeHtml(timeStr)}</span>`);
    }
    if (lastRefresh) {
        const refreshDate = new Date(typeof lastRefresh === 'number' ? lastRefresh * 1000 : lastRefresh);
        items.push(`<strong>Last Refresh:</strong> ${escapeHtml(refreshDate.toLocaleString())}`);
    }

    if (items.length > 0) {
        html = '<div style="font-size:13px;color:var(--text-secondary);line-height:1.8;">';
        html += items.join('<br>');
        html += '</div>';
        html += '<div class="quota-progress-detail" style="margin-top:8px;">No public quota API available for Copilot. Check usage at github.com/settings/billing</div>';
    } else {
        html = '<div class="text-muted" style="font-size:13px;">No public quota API available for Copilot. Check usage at <a href="https://github.com/settings/billing" target="_blank" style="color:var(--accent-blue);">github.com/settings/billing</a></div>';
    }

    return html;
}

// === Shared rendering helpers ===

function renderProgressBar(label, usedPercent, detail) {
    const pct = Math.min(100, Math.max(0, usedPercent));
    const level = pct < 50 ? 'low' : pct < 75 ? 'medium' : pct < 90 ? 'high' : 'critical';
    const remainPct = Math.max(0, 100 - pct);

    let html = '<div class="quota-progress-container">';
    html += '<div class="quota-progress-label">';
    html += `<span class="quota-progress-label-name">${escapeHtml(label)}</span>`;
    html += `<span class="quota-progress-label-value">${pct.toFixed(1)}% used (${remainPct.toFixed(1)}% remaining)</span>`;
    html += '</div>';
    html += '<div class="quota-progress-bar">';
    html += `<div class="quota-progress-fill level-${level}" style="width:${pct}%"></div>`;
    html += '</div>';
    if (detail) {
        html += `<div class="quota-progress-detail">${escapeHtml(detail)}</div>`;
    }
    html += '</div>';
    return html;
}

// === Settings save functions (preserved) ===

async function saveQuotaSettings() {
    try {
        const switchProject = document.getElementById('switchProject').checked;
        const switchPreviewModel = document.getElementById('switchPreviewModel').checked;
        await Promise.all([
            API.updateSwitchProject(switchProject),
            API.updateSwitchPreviewModel(switchPreviewModel)
        ]);
        showAlert('Settings saved successfully!', 'success');
    } catch (error) {
        showAlert('Failed to save: ' + error.message, 'error');
    }
}

async function saveOAuthExcludedModels() {
    try {
        const text = document.getElementById('oauthExcludedModels').value;
        const models = text.split('\n').map(m => m.trim()).filter(m => m);
        await API.updateOAuthExcludedModels(models);
        showAlert('Excluded models saved successfully!', 'success');
    } catch (error) {
        showAlert('Failed to save: ' + error.message, 'error');
    }
}

async function saveOAuthModelMappings() {
    try {
        const text = document.getElementById('oauthModelMappings').value;
        const mappings = JSON.parse(text);
        await API.updateOAuthModelMappings(mappings);
        showAlert('Model mappings saved successfully!', 'success');
    } catch (error) {
        showAlert('Failed to save: ' + error.message, 'error');
    }
}
