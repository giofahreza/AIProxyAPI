// API Keys Page with integrated limits management

async function renderAPIKeys(container) {
    try {
        const [keysData, limitsData] = await Promise.all([
            API.getAPIKeys(),
            API.getAPIKeyLimits()
        ]);

        const keys = keysData.api_keys || keysData.apiKeys || keysData['api-keys'] || [];
        const limits = limitsData.api_key_limits || limitsData.apiKeyLimits || limitsData['api-key-limits'] || [];

        // Create a map of API key to its limits
        const limitsMap = {};
        limits.forEach(limit => {
            const apiKey = limit['api-key'] || limit.apiKey || limit.api_key;
            limitsMap[apiKey] = limit;
        });

        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">API Keys & Limits</h2>
                    <button class="btn btn-success" onclick="showAddAPIKeyDialog()">Add API Key</button>
                </div>
                <div class="card-body">
                    <div id="apiKeysAlert"></div>
                    <p class="text-muted mb-3">Manage API keys and configure model access restrictions and monthly quotas.</p>
                    ${keys.length === 0 ? '<p class="text-center">No API keys configured</p>' : `
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>API Key</th>
                                    <th>Allowed Models</th>
                                    <th>Monthly Quotas</th>
                                    <th width="150">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${keys.map(key => {
                                    const limit = limitsMap[key];
                                    const allowedModels = limit ? (limit['allowed-models'] || limit.allowedModels || limit.allowed_models || []) : [];
                                    const monthlyQuotas = limit ? (limit['monthly-quotas'] || limit.monthlyQuotas || limit.monthly_quotas || {}) : {};

                                    return `
                                        <tr>
                                            <td><code>${escapeHtml(key)}</code></td>
                                            <td>
                                                ${allowedModels.length === 0
                                                    ? '<span class="badge badge-success">All Models</span>'
                                                    : `<div class="model-list-compact">${allowedModels.slice(0, 3).map(m => `<span class="badge">${escapeHtml(m)}</span>`).join(' ')}${allowedModels.length > 3 ? ` <span class="text-muted">+${allowedModels.length - 3} more</span>` : ''}</div>`
                                                }
                                            </td>
                                            <td>
                                                ${Object.keys(monthlyQuotas).length === 0
                                                    ? '<span class="badge badge-info">Unlimited</span>'
                                                    : `<div class="quota-compact">${Object.entries(monthlyQuotas).slice(0, 2).map(([model, quota]) =>
                                                        `<div><code>${escapeHtml(model)}</code>: ${quota}/mo</div>`
                                                    ).join('')}${Object.keys(monthlyQuotas).length > 2 ? `<div class="text-muted">+${Object.keys(monthlyQuotas).length - 2} more</div>` : ''}</div>`
                                                }
                                            </td>
                                            <td>
                                                <button class="btn btn-primary btn-sm" onclick='editAPIKey(${JSON.stringify({key: key, limit: limit}).replace(/'/g, "&apos;")})'>Edit</button>
                                                <button class="btn btn-danger btn-sm" onclick="deleteAPIKey('${escapeHtml(key).replace(/'/g, "\\'")}')">Delete</button>
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    `}
                </div>
            </div>
        `;
    } catch (error) {
        showError(container, 'Failed to load API keys: ' + error.message);
    }
}

function showAddAPIKeyDialog() {
    showModal('Add API Key', `
        <div class="form-group">
            <label for="newApiKey">API Key *</label>
            <input type="text" id="newApiKey" placeholder="sk-your-api-key" required>
        </div>

        <hr style="margin: 20px 0; border: none; border-top: 1px solid var(--border-color);">
        <h4 style="margin-bottom: 15px;">Access Limits (Optional)</h4>

        <div class="form-group">
            <label for="allowedModels">Allowed Models</label>
            <textarea id="allowedModels" rows="4" placeholder="Leave empty for all models, or enter one per line:&#10;gpt-4&#10;claude-sonnet-4&#10;gpt-*"></textarea>
            <small class="form-text">Supports wildcards: gpt-*, claude-*, etc. Leave empty to allow all models.</small>
        </div>

        <div class="form-group">
            <label>Monthly Quotas</label>
            <div id="quotasContainer">
                <div class="quota-entry">
                    <input type="text" class="quota-model" placeholder="Model name or pattern" style="width: 58%;">
                    <input type="number" class="quota-limit" placeholder="Requests/month" style="width: 38%; margin-left: 4px;" min="1">
                </div>
            </div>
            <button type="button" class="btn btn-sm btn-secondary" style="margin-top: 8px;" onclick="addQuotaEntry()">+ Add Quota</button>
            <small class="form-text">Set monthly request limits per model. Leave empty for unlimited.</small>
        </div>
    `, async () => {
        const key = document.getElementById('newApiKey').value.trim();
        if (!key) {
            alert('Please enter an API key');
            return;
        }

        const allowedModelsText = document.getElementById('allowedModels').value.trim();
        const allowedModels = allowedModelsText
            ? allowedModelsText.split('\n').map(m => m.trim()).filter(m => m)
            : [];

        const monthlyQuotas = {};
        document.querySelectorAll('.quota-entry').forEach(entry => {
            const model = entry.querySelector('.quota-model').value.trim();
            const limit = parseInt(entry.querySelector('.quota-limit').value);
            if (model && limit > 0) {
                monthlyQuotas[model] = limit;
            }
        });

        try {
            // Add the API key first
            await API.addAPIKey(key);

            // If there are limits, add them
            if (allowedModels.length > 0 || Object.keys(monthlyQuotas).length > 0) {
                await API.addOrUpdateAPIKeyLimit({
                    'api-key': key,
                    'allowed-models': allowedModels,
                    'monthly-quotas': monthlyQuotas
                });
            }

            showAlert('API key added successfully with limits', 'success');
            renderAPIKeys(document.getElementById('pageContent'));
        } catch (error) {
            showAlert('Failed to add API key: ' + error.message, 'error');
        }
    });
}

function editAPIKey(data) {
    const oldKey = data.key;
    const limit = data.limit || {};

    const allowedModels = limit['allowed-models'] || limit.allowedModels || limit.allowed_models || [];
    const monthlyQuotas = limit['monthly-quotas'] || limit.monthlyQuotas || limit.monthly_quotas || {};

    const quotasHtml = Object.keys(monthlyQuotas).length > 0
        ? Object.entries(monthlyQuotas).map(([model, quota]) => `
            <div class="quota-entry">
                <input type="text" class="quota-model" value="${escapeHtml(model)}" placeholder="Model name or pattern" style="width: 58%;">
                <input type="number" class="quota-limit" value="${quota}" placeholder="Requests/month" style="width: 38%; margin-left: 4px;" min="1">
            </div>
        `).join('')
        : `<div class="quota-entry">
            <input type="text" class="quota-model" placeholder="Model name or pattern" style="width: 58%;">
            <input type="number" class="quota-limit" placeholder="Requests/month" style="width: 38%; margin-left: 4px;" min="1">
        </div>`;

    showModal('Edit API Key & Limits', `
        <div class="form-group">
            <label for="editApiKey">API Key</label>
            <input type="text" id="editApiKey" value="${escapeHtml(oldKey)}" placeholder="your-api-key">
        </div>

        <hr style="margin: 20px 0; border: none; border-top: 1px solid var(--border-color);">
        <h4 style="margin-bottom: 15px;">Access Limits (Optional)</h4>

        <div class="form-group">
            <label for="allowedModels">Allowed Models</label>
            <textarea id="allowedModels" rows="4" placeholder="Leave empty for all models, or enter one per line:&#10;gpt-4&#10;claude-sonnet-4&#10;gpt-*">${escapeHtml(allowedModels.join('\n'))}</textarea>
            <small class="form-text">Supports wildcards: gpt-*, claude-*, etc. Leave empty to allow all models.</small>
        </div>

        <div class="form-group">
            <label>Monthly Quotas</label>
            <div id="quotasContainer">
                ${quotasHtml}
            </div>
            <button type="button" class="btn btn-sm btn-secondary" style="margin-top: 8px;" onclick="addQuotaEntry()">+ Add Quota</button>
            <small class="form-text">Set monthly request limits per model. Leave empty for unlimited.</small>
        </div>
    `, async () => {
        const newKey = document.getElementById('editApiKey').value.trim();
        if (!newKey) {
            alert('Please enter an API key');
            return;
        }

        const allowedModelsText = document.getElementById('allowedModels').value.trim();
        const allowedModels = allowedModelsText
            ? allowedModelsText.split('\n').map(m => m.trim()).filter(m => m)
            : [];

        const monthlyQuotas = {};
        document.querySelectorAll('.quota-entry').forEach(entry => {
            const model = entry.querySelector('.quota-model').value.trim();
            const limit = parseInt(entry.querySelector('.quota-limit').value);
            if (model && limit > 0) {
                monthlyQuotas[model] = limit;
            }
        });

        try {
            // If key changed, update it
            if (newKey !== oldKey) {
                await API.patch('/api-keys', { old: oldKey, new: newKey });

                // If there was an old limit, delete it
                if (limit && (limit['api-key'] || limit.apiKey || limit.api_key)) {
                    try {
                        await API.deleteAPIKeyLimit(oldKey);
                    } catch (e) {
                        // Ignore if limit didn't exist
                    }
                }
            }

            // Update or create limits
            if (allowedModels.length > 0 || Object.keys(monthlyQuotas).length > 0) {
                await API.addOrUpdateAPIKeyLimit({
                    'api-key': newKey,
                    'allowed-models': allowedModels,
                    'monthly-quotas': monthlyQuotas
                });
            } else {
                // No limits specified, remove any existing limits
                try {
                    await API.deleteAPIKeyLimit(newKey);
                } catch (e) {
                    // Ignore if limit didn't exist
                }
            }

            showAlert('API key and limits updated successfully', 'success');
            renderAPIKeys(document.getElementById('pageContent'));
        } catch (error) {
            showAlert('Failed to update API key: ' + error.message, 'error');
        }
    });
}

async function deleteAPIKey(key) {
    if (!confirm(`Are you sure you want to delete this API key?\n\nKey: ${key}\n\nThis will also remove any associated limits.`)) return;

    try {
        // Delete the API key
        await API.deleteAPIKey(key);

        // Also try to delete any associated limits
        try {
            await API.deleteAPIKeyLimit(key);
        } catch (e) {
            // Ignore if no limits existed
        }

        showAlert('API key and limits deleted successfully', 'success');
        renderAPIKeys(document.getElementById('pageContent'));
    } catch (error) {
        showAlert('Failed to delete API key: ' + error.message, 'error');
    }
}

function addQuotaEntry() {
    const container = document.getElementById('quotasContainer');
    const newEntry = document.createElement('div');
    newEntry.className = 'quota-entry';
    newEntry.innerHTML = `
        <input type="text" class="quota-model" placeholder="Model name or pattern" style="width: 58%;">
        <input type="number" class="quota-limit" placeholder="Requests/month" style="width: 38%; margin-left: 4px;" min="1">
    `;
    container.appendChild(newEntry);
}
