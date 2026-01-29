// API Key Limits Page

async function renderAPIKeyLimits(container) {
    try {
        const data = await API.getAPIKeyLimits();
        const limits = data.api_key_limits || data.apiKeyLimits || data['api-key-limits'] || [];

        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">API Key Limits</h2>
                    <button class="btn btn-success" onclick="showAddAPIKeyLimitDialog()">Add Limit</button>
                </div>
                <div class="card-body">
                    <div id="apiKeyLimitsAlert"></div>
                    <p class="text-muted">Control which models each API key can access and set monthly request quotas.</p>
                    ${limits.length === 0 ? '<p class="text-center">No API key limits configured. All API keys have unlimited access.</p>' : `
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
                                ${limits.map(limit => {
                                    const allowedModels = limit['allowed-models'] || limit.allowedModels || limit.allowed_models || [];
                                    const monthlyQuotas = limit['monthly-quotas'] || limit.monthlyQuotas || limit.monthly_quotas || {};
                                    const apiKey = limit['api-key'] || limit.apiKey || limit.api_key || '';

                                    return `
                                        <tr>
                                            <td><code>${escapeHtml(apiKey)}</code></td>
                                            <td>
                                                ${allowedModels.length === 0
                                                    ? '<span class="badge badge-success">All Models</span>'
                                                    : `<div class="model-list">${allowedModels.map(m => `<span class="badge">${escapeHtml(m)}</span>`).join(' ')}</div>`
                                                }
                                            </td>
                                            <td>
                                                ${Object.keys(monthlyQuotas).length === 0
                                                    ? '<span class="badge badge-info">No Limits</span>'
                                                    : `<div class="quota-list">${Object.entries(monthlyQuotas).map(([model, quota]) =>
                                                        `<div><code>${escapeHtml(model)}</code>: ${quota} req/month</div>`
                                                    ).join('')}</div>`
                                                }
                                            </td>
                                            <td>
                                                <button class="btn btn-primary btn-sm" onclick='editAPIKeyLimit(${JSON.stringify(limit).replace(/'/g, "&apos;")})'>Edit</button>
                                                <button class="btn btn-danger btn-sm" onclick="deleteAPIKeyLimit('${escapeHtml(apiKey).replace(/'/g, "\\'")}')">Delete</button>
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
        showError(container, 'Failed to load API key limits: ' + error.message);
    }
}

function showAddAPIKeyLimitDialog() {
    showModal('Add API Key Limit', `
        <div class="form-group">
            <label for="limitApiKey">API Key *</label>
            <input type="text" id="limitApiKey" placeholder="sk-your-api-key" required>
        </div>
        <div class="form-group">
            <label for="allowedModels">Allowed Models (one per line, leave empty for all)</label>
            <textarea id="allowedModels" rows="5" placeholder="gpt-4&#10;claude-sonnet-4&#10;gpt-*"></textarea>
            <small class="form-text">Supports wildcards: gpt-*, claude-*, etc.</small>
        </div>
        <div class="form-group">
            <label>Monthly Quotas</label>
            <div id="quotasContainer">
                <div class="quota-entry">
                    <input type="text" class="quota-model" placeholder="Model name or pattern" style="width: 60%;">
                    <input type="number" class="quota-limit" placeholder="Requests/month" style="width: 35%; margin-left: 5px;" min="1">
                </div>
            </div>
            <button type="button" class="btn btn-sm btn-secondary" onclick="addQuotaEntry()">+ Add Quota</button>
        </div>
    `, async () => {
        const apiKey = document.getElementById('limitApiKey').value.trim();
        if (!apiKey) {
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
            await API.addOrUpdateAPIKeyLimit({
                'api-key': apiKey,
                'allowed-models': allowedModels,
                'monthly-quotas': monthlyQuotas
            });
            showAlert('API key limit added successfully', 'success');
            renderAPIKeyLimits(document.getElementById('pageContent'));
        } catch (error) {
            showAlert('Failed to add API key limit: ' + error.message, 'error');
        }
    });
}

function editAPIKeyLimit(limit) {
    const apiKey = limit['api-key'] || limit.apiKey || limit.api_key || '';
    const allowedModels = limit['allowed-models'] || limit.allowedModels || limit.allowed_models || [];
    const monthlyQuotas = limit['monthly-quotas'] || limit.monthlyQuotas || limit.monthly_quotas || {};

    const quotasHtml = Object.keys(monthlyQuotas).length > 0
        ? Object.entries(monthlyQuotas).map(([model, quota]) => `
            <div class="quota-entry">
                <input type="text" class="quota-model" value="${escapeHtml(model)}" placeholder="Model name or pattern" style="width: 60%;">
                <input type="number" class="quota-limit" value="${quota}" placeholder="Requests/month" style="width: 35%; margin-left: 5px;" min="1">
            </div>
        `).join('')
        : `<div class="quota-entry">
            <input type="text" class="quota-model" placeholder="Model name or pattern" style="width: 60%;">
            <input type="number" class="quota-limit" placeholder="Requests/month" style="width: 35%; margin-left: 5px;" min="1">
        </div>`;

    showModal('Edit API Key Limit', `
        <div class="form-group">
            <label for="limitApiKey">API Key</label>
            <input type="text" id="limitApiKey" value="${escapeHtml(apiKey)}" readonly style="background-color: #f5f5f5;">
        </div>
        <div class="form-group">
            <label for="allowedModels">Allowed Models (one per line, leave empty for all)</label>
            <textarea id="allowedModels" rows="5" placeholder="gpt-4&#10;claude-sonnet-4&#10;gpt-*">${escapeHtml(allowedModels.join('\n'))}</textarea>
            <small class="form-text">Supports wildcards: gpt-*, claude-*, etc.</small>
        </div>
        <div class="form-group">
            <label>Monthly Quotas</label>
            <div id="quotasContainer">
                ${quotasHtml}
            </div>
            <button type="button" class="btn btn-sm btn-secondary" onclick="addQuotaEntry()">+ Add Quota</button>
        </div>
    `, async () => {
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
            await API.addOrUpdateAPIKeyLimit({
                'api-key': apiKey,
                'allowed-models': allowedModels,
                'monthly-quotas': monthlyQuotas
            });
            showAlert('API key limit updated successfully', 'success');
            renderAPIKeyLimits(document.getElementById('pageContent'));
        } catch (error) {
            showAlert('Failed to update API key limit: ' + error.message, 'error');
        }
    });
}

function addQuotaEntry() {
    const container = document.getElementById('quotasContainer');
    const newEntry = document.createElement('div');
    newEntry.className = 'quota-entry';
    newEntry.innerHTML = `
        <input type="text" class="quota-model" placeholder="Model name or pattern" style="width: 60%;">
        <input type="number" class="quota-limit" placeholder="Requests/month" style="width: 35%; margin-left: 5px;" min="1">
    `;
    container.appendChild(newEntry);
}

async function deleteAPIKeyLimit(apiKey) {
    if (!confirm(`Are you sure you want to delete the limit for API key: ${apiKey}?`)) return;

    try {
        await API.deleteAPIKeyLimit(apiKey);
        showAlert('API key limit deleted successfully', 'success');
        renderAPIKeyLimits(document.getElementById('pageContent'));
    } catch (error) {
        showAlert('Failed to delete API key limit: ' + error.message, 'error');
    }
}
