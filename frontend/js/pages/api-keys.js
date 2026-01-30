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
                    <p class="text-muted mb-3">Manage API keys and configure model access restrictions, credential restrictions, and monthly quotas.</p>
                    ${keys.length === 0 ? '<p class="text-center">No API keys configured</p>' : `
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>API Key</th>
                                    <th>Allowed Models</th>
                                    <th>Allowed Credentials</th>
                                    <th>Monthly Quotas</th>
                                    <th width="150">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${keys.map(key => {
                                    const limit = limitsMap[key];
                                    const allowedModels = limit ? (limit['allowed-models'] || limit.allowedModels || limit.allowed_models || []) : [];
                                    const monthlyQuotas = limit ? (limit['monthly-quotas'] || limit.monthlyQuotas || limit.monthly_quotas || {}) : {};
                                    const allowedCredentials = limit ? (limit['allowed-credentials'] || limit.allowedCredentials || limit.allowed_credentials || []) : [];

                                    // Generate quota display with unlimited indicators
                                    let quotaDisplay;
                                    if (allowedModels.length === 0 && Object.keys(monthlyQuotas).length === 0) {
                                        quotaDisplay = '<span class="badge badge-info">Unlimited</span>';
                                    } else if (allowedModels.length > 0) {
                                        // Show quotas for allowed models
                                        const quotaEntries = [];
                                        const displayedModels = new Set();

                                        // First, show models with quotas
                                        Object.entries(monthlyQuotas).slice(0, 2).forEach(([model, quota]) => {
                                            quotaEntries.push(`<div><code>${escapeHtml(model)}</code>: ${quota}/mo</div>`);
                                            displayedModels.add(model);
                                        });

                                        // Then show some allowed models without quotas as "unlimited"
                                        const remainingSlots = 2 - quotaEntries.length;
                                        if (remainingSlots > 0) {
                                            allowedModels.slice(0, remainingSlots).forEach(model => {
                                                if (!monthlyQuotas[model]) {
                                                    quotaEntries.push(`<div><code>${escapeHtml(model)}</code>: <span class="badge badge-info badge-sm">Unlimited</span></div>`);
                                                    displayedModels.add(model);
                                                }
                                            });
                                        }

                                        const totalItems = Object.keys(monthlyQuotas).length + allowedModels.filter(m => !monthlyQuotas[m]).length;
                                        const moreCount = totalItems - displayedModels.size;

                                        quotaDisplay = `<div class="quota-compact">${quotaEntries.join('')}${moreCount > 0 ? `<div class="text-muted">+${moreCount} more</div>` : ''}</div>`;
                                    } else {
                                        quotaDisplay = `<div class="quota-compact">${Object.entries(monthlyQuotas).slice(0, 2).map(([model, quota]) =>
                                            `<div><code>${escapeHtml(model)}</code>: ${quota}/mo</div>`
                                        ).join('')}${Object.keys(monthlyQuotas).length > 2 ? `<div class="text-muted">+${Object.keys(monthlyQuotas).length - 2} more</div>` : ''}</div>`;
                                    }

                                    // Generate credential display
                                    let credentialDisplay;
                                    if (allowedCredentials.length === 0) {
                                        credentialDisplay = '<span class="badge badge-success">All</span>';
                                    } else {
                                        const shown = allowedCredentials.slice(0, 2).map(id => `<code>${escapeHtml(id.length > 20 ? id.substring(0, 17) + '...' : id)}</code>`).join(', ');
                                        const moreCount = allowedCredentials.length - 2;
                                        credentialDisplay = `<div class="quota-compact">${shown}${moreCount > 0 ? ` <span class="text-muted">+${moreCount} more</span>` : ''}</div>`;
                                    }

                                    return `
                                        <tr>
                                            <td><code>${escapeHtml(key)}</code></td>
                                            <td>
                                                ${allowedModels.length === 0
                                                    ? '<span class="badge badge-success">All Models</span>'
                                                    : `<div class="model-list-compact">${allowedModels.slice(0, 3).map(m => `<span class="badge">${escapeHtml(m)}</span>`).join(' ')}${allowedModels.length > 3 ? ` <span class="text-muted">+${allowedModels.length - 3} more</span>` : ''}</div>`
                                                }
                                            </td>
                                            <td>${credentialDisplay}</td>
                                            <td>${quotaDisplay}</td>
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

async function showAddAPIKeyDialog() {
    // Fetch available credentials for the checkbox list
    let credentials = [];
    try {
        const authFiles = await API.listAuthFiles();
        credentials = authFiles.files || authFiles || [];
    } catch (e) {
        // If fetching fails, we'll just show an empty list
    }

    const credentialCheckboxes = credentials.length > 0
        ? credentials.map(cred => {
            const id = cred.id || cred.ID || '';
            const provider = cred.provider || cred.Provider || '';
            const account = cred.account || cred.email || cred.Account || cred.Email || id;
            return `<label class="checkbox-label">
                <input type="checkbox" class="credential-checkbox" value="${escapeHtml(id)}">
                <span class="badge badge-sm">${escapeHtml(provider)}</span> ${escapeHtml(account)}
            </label>`;
        }).join('')
        : '<small class="text-muted">No credentials available</small>';

    showModal('Add API Key', `
        <div class="form-group">
            <label for="newApiKey">API Key *</label>
            <input type="text" id="newApiKey" placeholder="sk-your-api-key" required>
        </div>

        <hr style="margin: 20px 0; border: none; border-top: 1px solid var(--border-color);">
        <h4 style="margin-bottom: 15px;">Access Limits (Optional)</h4>

        <div class="form-group">
            <label>Allowed Models</label>
            <div style="margin-bottom: 10px;">
                <small class="form-text" style="margin-bottom: 8px; display: block;">Select common patterns or add custom models below:</small>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; margin-bottom: 12px;">
                    <label class="checkbox-label">
                        <input type="checkbox" class="model-checkbox" value="gpt-*"> GPT Models (gpt-*)
                    </label>
                    <label class="checkbox-label">
                        <input type="checkbox" class="model-checkbox" value="gpt-4*"> GPT-4 (gpt-4*)
                    </label>
                    <label class="checkbox-label">
                        <input type="checkbox" class="model-checkbox" value="claude-*"> Claude (claude-*)
                    </label>
                    <label class="checkbox-label">
                        <input type="checkbox" class="model-checkbox" value="claude-sonnet-*"> Claude Sonnet (claude-sonnet-*)
                    </label>
                    <label class="checkbox-label">
                        <input type="checkbox" class="model-checkbox" value="gemini-*"> Gemini (gemini-*)
                    </label>
                    <label class="checkbox-label">
                        <input type="checkbox" class="model-checkbox" value="o1-*"> O1 Models (o1-*)
                    </label>
                </div>
            </div>
            <label for="allowedModels">Custom Models (Advanced)</label>
            <textarea id="allowedModels" rows="3" placeholder="Add custom model names or patterns (one per line)"></textarea>
            <small class="form-text">Leave all empty to allow all models. Supports wildcards like gpt-*, claude-*, etc.</small>
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

        <div class="form-group">
            <label>Allowed Credentials</label>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 8px; margin-bottom: 8px;">
                ${credentialCheckboxes}
            </div>
            <small class="form-text">Leave all unchecked to allow all credentials.</small>
        </div>
    `, async () => {
        const key = document.getElementById('newApiKey').value.trim();
        if (!key) {
            alert('Please enter an API key');
            return;
        }

        // Collect selected checkboxes
        const checkedModels = Array.from(document.querySelectorAll('.model-checkbox:checked'))
            .map(cb => cb.value);

        // Collect custom models from textarea
        const allowedModelsText = document.getElementById('allowedModels').value.trim();
        const customModels = allowedModelsText
            ? allowedModelsText.split('\n').map(m => m.trim()).filter(m => m)
            : [];

        // Combine and deduplicate
        const allowedModels = [...new Set([...checkedModels, ...customModels])];

        const monthlyQuotas = {};
        document.querySelectorAll('.quota-entry').forEach(entry => {
            const model = entry.querySelector('.quota-model').value.trim();
            const limit = parseInt(entry.querySelector('.quota-limit').value);
            if (model && limit > 0) {
                monthlyQuotas[model] = limit;
            }
        });

        // Collect selected credentials
        const allowedCredentials = Array.from(document.querySelectorAll('.credential-checkbox:checked'))
            .map(cb => cb.value);

        try {
            // Add the API key first
            await API.addAPIKey(key);

            // If there are limits, add them
            if (allowedModels.length > 0 || Object.keys(monthlyQuotas).length > 0 || allowedCredentials.length > 0) {
                await API.addOrUpdateAPIKeyLimit({
                    'api-key': key,
                    'allowed-models': allowedModels,
                    'monthly-quotas': monthlyQuotas,
                    'allowed-credentials': allowedCredentials
                });
            }

            showAlert('API key added successfully with limits', 'success');
            renderAPIKeys(document.getElementById('pageContent'));
        } catch (error) {
            showAlert('Failed to add API key: ' + error.message, 'error');
        }
    });
}

async function editAPIKey(data) {
    const oldKey = data.key;
    const limit = data.limit || {};

    const allowedModels = limit['allowed-models'] || limit.allowedModels || limit.allowed_models || [];
    const monthlyQuotas = limit['monthly-quotas'] || limit.monthlyQuotas || limit.monthly_quotas || {};
    const allowedCredentials = limit['allowed-credentials'] || limit.allowedCredentials || limit.allowed_credentials || [];

    // Separate checkbox patterns from custom models
    const checkboxPatterns = ['gpt-*', 'gpt-4*', 'claude-*', 'claude-sonnet-*', 'gemini-*', 'o1-*'];
    const customModels = allowedModels.filter(m => !checkboxPatterns.includes(m));

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

    // Fetch available credentials for the checkbox list
    let credentials = [];
    try {
        const authFiles = await API.listAuthFiles();
        credentials = authFiles.files || authFiles || [];
    } catch (e) {
        // If fetching fails, we'll just show an empty list
    }

    const credentialCheckboxes = credentials.length > 0
        ? credentials.map(cred => {
            const id = cred.id || cred.ID || '';
            const provider = cred.provider || cred.Provider || '';
            const account = cred.account || cred.email || cred.Account || cred.Email || id;
            const isChecked = allowedCredentials.includes(id) ? 'checked' : '';
            return `<label class="checkbox-label">
                <input type="checkbox" class="credential-checkbox" value="${escapeHtml(id)}" ${isChecked}>
                <span class="badge badge-sm">${escapeHtml(provider)}</span> ${escapeHtml(account)}
            </label>`;
        }).join('')
        : '<small class="text-muted">No credentials available</small>';

    showModal('Edit API Key & Limits', `
        <div class="form-group">
            <label for="editApiKey">API Key</label>
            <input type="text" id="editApiKey" value="${escapeHtml(oldKey)}" placeholder="your-api-key">
        </div>

        <hr style="margin: 20px 0; border: none; border-top: 1px solid var(--border-color);">
        <h4 style="margin-bottom: 15px;">Access Limits (Optional)</h4>

        <div class="form-group">
            <label>Allowed Models</label>
            <div style="margin-bottom: 10px;">
                <small class="form-text" style="margin-bottom: 8px; display: block;">Select common patterns or add custom models below:</small>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; margin-bottom: 12px;">
                    <label class="checkbox-label">
                        <input type="checkbox" class="model-checkbox" value="gpt-*" ${allowedModels.includes('gpt-*') ? 'checked' : ''}> GPT Models (gpt-*)
                    </label>
                    <label class="checkbox-label">
                        <input type="checkbox" class="model-checkbox" value="gpt-4*" ${allowedModels.includes('gpt-4*') ? 'checked' : ''}> GPT-4 (gpt-4*)
                    </label>
                    <label class="checkbox-label">
                        <input type="checkbox" class="model-checkbox" value="claude-*" ${allowedModels.includes('claude-*') ? 'checked' : ''}> Claude (claude-*)
                    </label>
                    <label class="checkbox-label">
                        <input type="checkbox" class="model-checkbox" value="claude-sonnet-*" ${allowedModels.includes('claude-sonnet-*') ? 'checked' : ''}> Claude Sonnet (claude-sonnet-*)
                    </label>
                    <label class="checkbox-label">
                        <input type="checkbox" class="model-checkbox" value="gemini-*" ${allowedModels.includes('gemini-*') ? 'checked' : ''}> Gemini (gemini-*)
                    </label>
                    <label class="checkbox-label">
                        <input type="checkbox" class="model-checkbox" value="o1-*" ${allowedModels.includes('o1-*') ? 'checked' : ''}> O1 Models (o1-*)
                    </label>
                </div>
            </div>
            <label for="allowedModels">Custom Models (Advanced)</label>
            <textarea id="allowedModels" rows="3" placeholder="Add custom model names or patterns (one per line)">${escapeHtml(customModels.join('\n'))}</textarea>
            <small class="form-text">Leave all empty to allow all models. Supports wildcards like gpt-*, claude-*, etc.</small>
        </div>

        <div class="form-group">
            <label>Monthly Quotas</label>
            <div id="quotasContainer">
                ${quotasHtml}
            </div>
            <button type="button" class="btn btn-sm btn-secondary" style="margin-top: 8px;" onclick="addQuotaEntry()">+ Add Quota</button>
            <small class="form-text">Set monthly request limits per model. Leave empty for unlimited.</small>
        </div>

        <div class="form-group">
            <label>Allowed Credentials</label>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 8px; margin-bottom: 8px;">
                ${credentialCheckboxes}
            </div>
            <small class="form-text">Leave all unchecked to allow all credentials.</small>
        </div>
    `, async () => {
        const newKey = document.getElementById('editApiKey').value.trim();
        if (!newKey) {
            alert('Please enter an API key');
            return;
        }

        // Collect selected checkboxes
        const checkedModels = Array.from(document.querySelectorAll('.model-checkbox:checked'))
            .map(cb => cb.value);

        // Collect custom models from textarea
        const allowedModelsText = document.getElementById('allowedModels').value.trim();
        const customModels = allowedModelsText
            ? allowedModelsText.split('\n').map(m => m.trim()).filter(m => m)
            : [];

        // Combine and deduplicate
        const allowedModels = [...new Set([...checkedModels, ...customModels])];

        const monthlyQuotas = {};
        document.querySelectorAll('.quota-entry').forEach(entry => {
            const model = entry.querySelector('.quota-model').value.trim();
            const limit = parseInt(entry.querySelector('.quota-limit').value);
            if (model && limit > 0) {
                monthlyQuotas[model] = limit;
            }
        });

        // Collect selected credentials
        const allowedCredentials = Array.from(document.querySelectorAll('.credential-checkbox:checked'))
            .map(cb => cb.value);

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
            if (allowedModels.length > 0 || Object.keys(monthlyQuotas).length > 0 || allowedCredentials.length > 0) {
                await API.addOrUpdateAPIKeyLimit({
                    'api-key': newKey,
                    'allowed-models': allowedModels,
                    'monthly-quotas': monthlyQuotas,
                    'allowed-credentials': allowedCredentials
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
