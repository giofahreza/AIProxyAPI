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
            const hasQuota = ['codex', 'gemini-cli', 'antigravity', 'claude', 'copilot', 'qwen'].includes(type);

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
            if (!['codex', 'gemini-cli', 'antigravity', 'claude', 'copilot', 'qwen'].includes(type)) continue;
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
        } else if (type === 'qwen') {
            html = await renderTokenMetadataQuota(authIndex, cred, 'Qwen');
        }
        bodyEl.innerHTML = html || '<div class="text-muted" style="font-size:13px;">No quota data available.</div>';
    } catch (error) {
        bodyEl.innerHTML = `<div class="quota-credential-error">Failed to load quota: ${escapeHtml(error.message)}</div>`;
    }
}

// === Codex Quota ===
async function renderCodexQuota(authIndex, cred) {
    const headers = {
        'Authorization': 'Bearer $TOKEN$',
        'Content-Type': 'application/json',
        'User-Agent': 'codex_cli_rs/0.76.0 (Debian 13.0.0; x86_64) WindowsTerminal'
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

    // Plan type
    const planType = data.plan_type || data.planType;
    if (planType) {
        html += `<div style="margin-bottom:8px;font-size:13px;color:var(--text-secondary);">Plan: <strong>${escapeHtml(planType)}</strong></div>`;
    }

    // Rate limit (code generation)
    const rateLimit = data.rate_limit ?? data.rateLimit;
    if (rateLimit) {
        html += renderCodexRateLimitSection('Code Generation', rateLimit);
    }

    // Code review rate limit
    const codeReviewLimit = data.code_review_rate_limit ?? data.codeReviewRateLimit;
    if (codeReviewLimit) {
        html += renderCodexRateLimitSection('Code Review', codeReviewLimit);
    }

    return html || '<div class="text-muted" style="font-size:13px;">No rate limit data in response.</div>';
}

function getCodexWindowSeconds(window) {
    const raw = window.limit_window_seconds ?? window.limitWindowSeconds;
    if (raw === null || raw === undefined) return 0;
    return typeof raw === 'number' ? raw : parseFloat(raw) || 0;
}

function getCodexUsedPercent(window) {
    const raw = window.used_percent ?? window.usedPercent;
    if (raw === null || raw === undefined) return null;
    const val = typeof raw === 'number' ? raw : parseFloat(raw);
    return isNaN(val) ? null : val;
}

function getCodexResetLabel(window) {
    // Try reset_at (unix timestamp) first
    const resetAt = window.reset_at ?? window.resetAt;
    if (resetAt) {
        const ts = typeof resetAt === 'number' ? resetAt : parseFloat(resetAt);
        if (!isNaN(ts) && ts > 0) {
            // reset_at could be seconds or milliseconds
            const date = new Date(ts > 1e12 ? ts : ts * 1000);
            return formatResetTime(date.toISOString());
        }
    }
    // Try reset_after_seconds
    const resetAfter = window.reset_after_seconds ?? window.resetAfterSeconds;
    if (resetAfter) {
        const secs = typeof resetAfter === 'number' ? resetAfter : parseFloat(resetAfter);
        if (!isNaN(secs) && secs > 0) {
            const mins = Math.floor(secs / 60);
            if (mins < 60) return `in ${mins}m`;
            const hours = Math.floor(mins / 60);
            return `in ${hours}h ${mins % 60}m`;
        }
    }
    return '';
}

function renderCodexRateLimitSection(title, rateLimit) {
    const FIVE_HOUR_SECONDS = 18000;
    const WEEK_SECONDS = 604800;

    let html = `<div style="margin-bottom:12px;"><strong style="color:var(--text-primary);font-size:13px;">${escapeHtml(title)}</strong></div>`;

    // Extract primary and secondary windows
    const primaryWindow = rateLimit.primary_window ?? rateLimit.primaryWindow ?? null;
    const secondaryWindow = rateLimit.secondary_window ?? rateLimit.secondaryWindow ?? null;

    // Classify windows by duration
    let fiveHourWindow = null;
    let weeklyWindow = null;

    for (const w of [primaryWindow, secondaryWindow]) {
        if (!w) continue;
        const seconds = getCodexWindowSeconds(w);
        if (seconds === FIVE_HOUR_SECONDS && !fiveHourWindow) {
            fiveHourWindow = w;
        } else if (seconds === WEEK_SECONDS && !weeklyWindow) {
            weeklyWindow = w;
        } else if (!fiveHourWindow) {
            fiveHourWindow = w;
        } else if (!weeklyWindow) {
            weeklyWindow = w;
        }
    }

    if (fiveHourWindow) {
        const pct = getCodexUsedPercent(fiveHourWindow);
        if (pct !== null) {
            const resetLabel = getCodexResetLabel(fiveHourWindow);
            html += renderProgressBar('5-Hour Window', pct * 100, resetLabel ? `Resets ${resetLabel}` : '');
        }
    }

    if (weeklyWindow) {
        const pct = getCodexUsedPercent(weeklyWindow);
        if (pct !== null) {
            const resetLabel = getCodexResetLabel(weeklyWindow);
            html += renderProgressBar('Weekly Window', pct * 100, resetLabel ? `Resets ${resetLabel}` : '');
        }
    }

    return html;
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
function extractProjectIdFromAccount(account) {
    if (typeof account !== 'string') return null;
    const matches = [...account.matchAll(/\(([^()]+)\)/g)];
    if (matches.length === 0) return null;
    return matches[matches.length - 1]?.[1]?.trim() || null;
}

async function renderGeminiCliQuota(authIndex, cred) {
    // Check multiple locations for project_id
    let projectId = cred?.project_id || cred?.projectId;

    // Try extracting from account field (format: "email (project_id)")
    if (!projectId) {
        projectId = extractProjectIdFromAccount(cred?.account)
            || extractProjectIdFromAccount(cred?.metadata?.account)
            || extractProjectIdFromAccount(cred?.attributes?.account);
    }

    // Try metadata.project_id directly
    if (!projectId && cred?.metadata?.project_id) {
        projectId = cred.metadata.project_id;
    }

    // Last resort: download auth file to extract project_id (similar to antigravity)
    if (!projectId) {
        const fileName = cred?.name || cred?.file_name || cred?.fileName;
        if (fileName) {
            try {
                const fileContent = await API.downloadAuthFile(fileName);
                const parsed = typeof fileContent === 'string' ? JSON.parse(fileContent) : fileContent;
                if (parsed && typeof parsed === 'object') {
                    projectId = parsed.project_id || parsed.projectId || '';
                }
            } catch (e) {
                console.warn('Failed to download gemini-cli auth file for project_id:', e);
            }
        }
    }

    if (!projectId) {
        return '<div class="quota-credential-error">No project ID found for this credential. Expected format: email (project_id) in account field.</div>';
    }
    const body = JSON.stringify({ project: projectId });

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
async function resolveAntigravityProjectId(cred) {
    const DEFAULT_PROJECT = 'bamboo-precept-lgxtn';
    // Check cred fields first
    if (cred?.project_id) return cred.project_id;
    if (cred?.projectId) return cred.projectId;

    // Download auth file content and parse for project_id
    const fileName = cred?.name || cred?.file_name || cred?.fileName;
    if (!fileName) return DEFAULT_PROJECT;

    try {
        const fileContent = await API.downloadAuthFile(fileName);
        // Backend returns application/json so API.request() auto-parses it
        const parsed = typeof fileContent === 'string' ? JSON.parse(fileContent) : fileContent;
        if (!parsed || typeof parsed !== 'object') return DEFAULT_PROJECT;

        // Check top-level project_id
        const topLevel = parsed.project_id || parsed.projectId;
        if (typeof topLevel === 'string' && topLevel.trim()) return topLevel.trim();

        // Check installed.project_id
        if (parsed.installed && typeof parsed.installed === 'object') {
            const installedPid = parsed.installed.project_id || parsed.installed.projectId;
            if (typeof installedPid === 'string' && installedPid.trim()) return installedPid.trim();
        }

        // Check web.project_id
        if (parsed.web && typeof parsed.web === 'object') {
            const webPid = parsed.web.project_id || parsed.web.projectId;
            if (typeof webPid === 'string' && webPid.trim()) return webPid.trim();
        }
    } catch (e) {
        console.warn('Failed to resolve antigravity project_id from auth file:', e);
    }

    return DEFAULT_PROJECT;
}

async function renderAntigravityQuota(authIndex, cred) {
    const projectId = await resolveAntigravityProjectId(cred);
    const body = JSON.stringify({ project: projectId });

    // Try primary URL first, fallback if needed
    const urls = [
        'https://daily-cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels',
        'https://daily-cloudcode-pa.sandbox.googleapis.com/v1internal:fetchAvailableModels',
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
                    'Content-Type': 'application/json',
                    'User-Agent': 'antigravity/1.11.5 windows/amd64'
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

    if (!data || !data.models || typeof data.models !== 'object') {
        return '<div class="text-muted" style="font-size:13px;">No model data returned.</div>';
    }

    const models = data.models;

    // Extract quota info from a model entry (matches CPAMC getAntigravityQuotaInfo)
    function getQuotaInfo(entry) {
        if (!entry || typeof entry !== 'object') return { remainingFraction: null, resetTime: null, displayName: null };
        const qi = entry.quotaInfo || entry.quota_info || {};
        const rawRemaining = qi.remainingFraction ?? qi.remaining_fraction ?? qi.remaining;
        let remainingFraction = null;
        if (rawRemaining !== null && rawRemaining !== undefined) {
            const val = typeof rawRemaining === 'number' ? rawRemaining : parseFloat(rawRemaining);
            if (!isNaN(val)) remainingFraction = val > 1 ? val / 100 : val;
        }
        const resetTime = qi.resetTime || qi.reset_time || null;
        const displayName = typeof entry.displayName === 'string' ? entry.displayName : null;
        return { remainingFraction, resetTime, displayName };
    }

    // Build a group from a definition (matches CPAMC buildAntigravityQuotaGroups)
    function buildGroup(def, overrideResetTime) {
        const quotaEntries = [];
        for (const identifier of def.identifiers) {
            const match = findAntigravityModel(models, identifier);
            if (!match) continue;
            const info = getQuotaInfo(match.info);
            // If remainingFraction is null but resetTime exists, treat as 0 (fully used)
            const remaining = info.remainingFraction ?? (info.resetTime ? 0 : null);
            if (remaining === null) continue;
            quotaEntries.push({
                id: match.id,
                remainingFraction: remaining,
                resetTime: info.resetTime,
                displayName: info.displayName
            });
        }
        if (quotaEntries.length === 0) return null;

        const remainingFraction = Math.min(...quotaEntries.map(e => e.remainingFraction));
        const resetTime = overrideResetTime || quotaEntries.map(e => e.resetTime).find(Boolean) || null;
        const displayName = quotaEntries.map(e => e.displayName).find(Boolean);
        const label = def.labelFromModel && displayName ? displayName : def.label;

        return { label, remainingFraction, resetTime };
    }

    // Predefined model groups matching CPAMC constants
    const groupDefs = [
        { id: 'claude-gpt', label: 'Claude/GPT', identifiers: ['claude-sonnet-4-5-thinking', 'claude-opus-4-5-thinking', 'claude-sonnet-4-5', 'gpt-oss-120b-medium'] },
        { id: 'gemini-3-pro', label: 'Gemini 3 Pro', identifiers: ['gemini-3-pro-high', 'gemini-3-pro-low'] },
        { id: 'gemini-2-5-flash', label: 'Gemini 2.5 Flash', identifiers: ['gemini-2.5-flash', 'gemini-2.5-flash-thinking'] },
        { id: 'gemini-2-5-flash-lite', label: 'Gemini 2.5 Flash Lite', identifiers: ['gemini-2.5-flash-lite'] },
        { id: 'gemini-2-5-cu', label: 'Gemini 2.5 CU', identifiers: ['rev19-uic3-1p'] },
        { id: 'gemini-3-flash', label: 'Gemini 3 Flash', identifiers: ['gemini-3-flash'] },
        { id: 'gemini-3-pro-image', label: 'gemini-3-pro-image', identifiers: ['gemini-3-pro-image'], labelFromModel: true },
    ];

    let html = '';
    let geminiProResetTime = null;

    // Build each group in order, matching CPAMC exactly
    const [claudeDef, geminiProDef, flashDef, flashLiteDef, cuDef, geminiFlashDef, imageDef] = groupDefs;

    const claudeGroup = buildGroup(claudeDef);
    if (claudeGroup) {
        const usedPct = (1 - Math.max(0, Math.min(1, claudeGroup.remainingFraction))) * 100;
        html += renderProgressBar(claudeGroup.label, usedPct, claudeGroup.resetTime ? `Resets ${formatResetTime(claudeGroup.resetTime)}` : '');
    }

    const geminiProGroup = buildGroup(geminiProDef);
    if (geminiProGroup) {
        geminiProResetTime = geminiProGroup.resetTime;
        const usedPct = (1 - Math.max(0, Math.min(1, geminiProGroup.remainingFraction))) * 100;
        html += renderProgressBar(geminiProGroup.label, usedPct, geminiProGroup.resetTime ? `Resets ${formatResetTime(geminiProGroup.resetTime)}` : '');
    }

    for (const def of [flashDef, flashLiteDef, cuDef, geminiFlashDef]) {
        const group = buildGroup(def);
        if (!group) continue;
        const usedPct = (1 - Math.max(0, Math.min(1, group.remainingFraction))) * 100;
        html += renderProgressBar(group.label, usedPct, group.resetTime ? `Resets ${formatResetTime(group.resetTime)}` : '');
    }

    // Image group uses geminiProResetTime as override
    const imageGroup = buildGroup(imageDef, geminiProResetTime);
    if (imageGroup) {
        const usedPct = (1 - Math.max(0, Math.min(1, imageGroup.remainingFraction))) * 100;
        html += renderProgressBar(imageGroup.label, usedPct, imageGroup.resetTime ? `Resets ${formatResetTime(imageGroup.resetTime)}` : '');
    }

    if (!html) {
        html = `<div class="text-muted" style="font-size:13px;">${Object.keys(models).length} model(s) found but none matched known quota groups.</div>`;
    }

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

        // Known windows in the response
        const windowDefs = [
            { key: 'five_hour', label: '5-Hour Window' },
            { key: 'seven_day', label: 'Weekly Window' },
            { key: 'seven_day_sonnet', label: 'Weekly Sonnet' },
            { key: 'seven_day_opus', label: 'Weekly Opus' },
            { key: 'seven_day_cowork', label: 'Weekly Cowork' },
            { key: 'seven_day_oauth_apps', label: 'Weekly OAuth Apps' },
            { key: 'iguana_necktie', label: 'Iguana Necktie' },
        ];

        for (const def of windowDefs) {
            const windowData = data[def.key];
            if (!windowData || typeof windowData !== 'object') continue;

            const utilization = windowData.utilization;
            if (utilization === null || utilization === undefined) continue;

            // utilization is already a percentage (e.g. 23.0 = 23%)
            const usedPct = utilization;
            const resetTime = windowData.resets_at || windowData.reset_time || windowData.resetTime;
            html += renderProgressBar(
                def.label,
                usedPct,
                resetTime ? `Resets ${formatResetTime(resetTime)}` : ''
            );
        }

        // Extra usage section
        if (data.extra_usage && typeof data.extra_usage === 'object') {
            const extra = data.extra_usage;
            if (extra.is_enabled) {
                const usedCredits = extra.used_credits ?? 0;
                const monthlyLimit = extra.monthly_limit;
                const utilization = extra.utilization;
                if (monthlyLimit) {
                    const pct = (usedCredits / monthlyLimit) * 100;
                    html += renderProgressBar(
                        'Extra Usage',
                        pct,
                        `$${usedCredits.toFixed(2)} / $${monthlyLimit.toFixed(2)}`
                    );
                } else if (utilization !== null && utilization !== undefined) {
                    html += renderProgressBar('Extra Usage', utilization, '');
                }
            }
        }

        if (!html) {
            html = '<div class="text-muted" style="font-size:13px;">No usage windows found in response.</div>';
        }

        return html;
    } catch (error) {
        return `<div class="quota-credential-error">Failed to fetch usage: ${escapeHtml(error.message)}</div>`;
    }
}

// === Copilot Info ===
async function renderCopilotQuota(authIndex, cred) {
    return renderTokenMetadataQuota(authIndex, cred, 'Copilot', 'github.com/settings/billing');
}

// === Generic Token Metadata Display ===
async function renderTokenMetadataQuota(authIndex, cred, providerName, billingUrl) {
    let html = '';
    const items = [];

    const sku = cred?.sku || cred?.plan || cred?.account_type;
    const email = cred?.email;
    const status = cred?.status;
    const expireRaw = cred?.copilot_expire || cred?.copilotExpire || cred?.expired || cred?.expire;
    const lastRefresh = cred?.last_refresh || cred?.lastRefresh;

    if (status) {
        const statusClass = status === 'ok' || status === 'active' ? 'text-success' : 'text-warning';
        items.push(`<strong>Status:</strong> <span class="${statusClass}">${escapeHtml(status)}</span>`);
    }
    if (sku) {
        items.push(`<strong>Plan:</strong> ${escapeHtml(sku)}`);
    }
    if (email) {
        items.push(`<strong>Account:</strong> ${escapeHtml(email)}`);
    }
    if (expireRaw) {
        const expireDate = new Date(typeof expireRaw === 'number' ? expireRaw * 1000 : expireRaw);
        if (!isNaN(expireDate.getTime())) {
            const now = new Date();
            const isExpired = expireDate <= now;
            const timeStr = isExpired ? 'Expired' : formatResetTime(expireDate.toISOString());
            const statusClass = isExpired ? 'text-danger' : 'text-success';
            items.push(`<strong>Token Expires:</strong> <span class="${statusClass}">${escapeHtml(timeStr)}</span>`);
        }
    }
    if (lastRefresh) {
        const refreshDate = new Date(typeof lastRefresh === 'number' ? lastRefresh * 1000 : lastRefresh);
        if (!isNaN(refreshDate.getTime())) {
            items.push(`<strong>Last Refresh:</strong> ${escapeHtml(refreshDate.toLocaleString())}`);
        }
    }

    if (items.length > 0) {
        html = '<div style="font-size:13px;color:var(--text-secondary);line-height:1.8;">';
        html += items.join('<br>');
        html += '</div>';
    }

    const note = billingUrl
        ? `No public quota API available for ${escapeHtml(providerName)}. Check usage at <a href="https://${escapeHtml(billingUrl)}" target="_blank" style="color:var(--accent-blue);">${escapeHtml(billingUrl)}</a>`
        : `No public quota API available for ${escapeHtml(providerName)}.`;
    html += `<div class="quota-progress-detail" style="margin-top:8px;">${note}</div>`;

    return html;
}

// === Antigravity Helpers ===
function findAntigravityModel(models, identifier) {
    // Direct key match
    if (models[identifier]) {
        return { id: identifier, info: models[identifier] };
    }
    // Match by displayName
    for (const [id, entry] of Object.entries(models)) {
        if (entry && typeof entry.displayName === 'string' && entry.displayName.toLowerCase() === identifier.toLowerCase()) {
            return { id, info: entry };
        }
    }
    return null;
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
