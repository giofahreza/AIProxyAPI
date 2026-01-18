// AI Providers Page

let currentProviderTab = 'gemini';

async function renderProviders(container) {
    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h2 class="card-title">AI Providers</h2>
                <button class="btn btn-secondary btn-sm" onclick="renderProviders(document.getElementById('pageContent'))">Refresh</button>
            </div>
            <div class="card-body">
                <div id="providersAlert"></div>

                <div class="tabs">
                    <div class="tab ${currentProviderTab === 'gemini' ? 'active' : ''}" onclick="switchProviderTab('gemini')">Gemini</div>
                    <div class="tab ${currentProviderTab === 'claude' ? 'active' : ''}" onclick="switchProviderTab('claude')">Claude</div>
                    <div class="tab ${currentProviderTab === 'codex' ? 'active' : ''}" onclick="switchProviderTab('codex')">Codex</div>
                    <div class="tab ${currentProviderTab === 'vertex' ? 'active' : ''}" onclick="switchProviderTab('vertex')">Vertex</div>
                    <div class="tab ${currentProviderTab === 'openai' ? 'active' : ''}" onclick="switchProviderTab('openai')">OpenAI Compatible</div>
                </div>

                <div id="providerContent"></div>
            </div>
        </div>
    `;

    await loadProviderTab(currentProviderTab);
}

function switchProviderTab(tab) {
    currentProviderTab = tab;
    document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.tabs .tab:nth-child(${['gemini', 'claude', 'codex', 'vertex', 'openai'].indexOf(tab) + 1})`).classList.add('active');
    loadProviderTab(tab);
}

async function loadProviderTab(tab) {
    const content = document.getElementById('providerContent');
    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        let keys = [];
        let addFn, editFn, deleteFn;

        switch (tab) {
            case 'gemini':
                keys = await API.getGeminiKeys() || [];
                addFn = 'showAddGeminiModal';
                editFn = 'showEditGeminiModal';
                deleteFn = 'deleteGeminiKey';
                break;
            case 'claude':
                keys = await API.getClaudeKeys() || [];
                addFn = 'showAddClaudeModal';
                editFn = 'showEditClaudeModal';
                deleteFn = 'deleteClaudeKey';
                break;
            case 'codex':
                keys = await API.getCodexKeys() || [];
                addFn = 'showAddCodexModal';
                editFn = 'showEditCodexModal';
                deleteFn = 'deleteCodexKey';
                break;
            case 'vertex':
                keys = await API.getVertexKeys() || [];
                addFn = 'showAddVertexModal';
                editFn = 'showEditVertexModal';
                deleteFn = 'deleteVertexKey';
                break;
            case 'openai':
                keys = await API.getOpenAICompat() || [];
                addFn = 'showAddOpenAIModal';
                editFn = 'showEditOpenAIModal';
                deleteFn = 'deleteOpenAICompat';
                break;
        }

        const keysList = Array.isArray(keys) ? keys : [];

        content.innerHTML = `
            <div class="flex-between mb-20">
                <div class="section-description">
                    ${getProviderDescription(tab)}
                </div>
                <button class="btn" onclick="${addFn}()">Add ${getProviderName(tab)}</button>
            </div>

            ${keysList.length === 0 ? `
                <div class="empty-state">
                    <div class="empty-state-title">No ${getProviderName(tab)} keys configured</div>
                    <div class="empty-state-description">Add API keys to enable ${getProviderName(tab)} models</div>
                </div>
            ` : `
                <div id="providersList">
                    ${keysList.map((key, idx) => renderProviderCard(tab, key, idx, editFn, deleteFn)).join('')}
                </div>
            `}
        `;
    } catch (error) {
        content.innerHTML = `<div class="alert alert-error">Failed to load: ${error.message}</div>`;
    }
}

function getProviderName(tab) {
    const names = {
        gemini: 'Gemini',
        claude: 'Claude',
        codex: 'Codex',
        vertex: 'Vertex',
        openai: 'OpenAI Compatible'
    };
    return names[tab] || tab;
}

function getProviderDescription(tab) {
    const descriptions = {
        gemini: 'Google Gemini API keys for accessing Gemini models',
        claude: 'Anthropic Claude API keys for Claude models',
        codex: 'Codex API keys for GPT-Codex models',
        vertex: 'Vertex AI compatible endpoint keys',
        openai: 'OpenAI-compatible API endpoints (OpenRouter, Groq, etc.)'
    };
    return descriptions[tab] || '';
}

function renderProviderCard(tab, key, idx, editFn, deleteFn) {
    const apiKey = key['api-key'] || key.apiKey || key.api_key || '';
    const maskedKey = apiKey ? maskApiKey(apiKey) : 'No key';
    const prefix = key.prefix || '';
    const baseUrl = key['base-url'] || key.baseUrl || key.base_url || '';
    const proxyUrl = key['proxy-url'] || key.proxyUrl || key.proxy_url || '';
    const name = key.name || '';

    // For OpenAI compat, show name instead of API key
    const displayName = tab === 'openai' ? (name || 'Unnamed Provider') : maskedKey;

    return `
        <div class="provider-card">
            <div class="provider-header">
                <div>
                    <span class="provider-name">${escapeHtml(displayName)}</span>
                    ${prefix ? `<span class="badge badge-info" style="margin-left: 10px;">${escapeHtml(prefix)}</span>` : ''}
                </div>
                <div class="provider-actions">
                    <button class="btn btn-secondary btn-sm" onclick="${editFn}(${idx})">Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="${deleteFn}(${idx})">Delete</button>
                </div>
            </div>
            <div class="provider-details">
                ${baseUrl ? `<div>Base URL: ${escapeHtml(baseUrl)}</div>` : ''}
                ${proxyUrl ? `<div>Proxy: ${escapeHtml(proxyUrl)}</div>` : ''}
                ${key.models && key.models.length > 0 ? `<div>Models: ${key.models.length} configured</div>` : ''}
                ${key['excluded-models'] && key['excluded-models'].length > 0 ? `<div>Excluded: ${key['excluded-models'].length} models</div>` : ''}
            </div>
        </div>
    `;
}

function maskApiKey(key) {
    if (!key || key.length < 10) return '***';
    return key.substring(0, 6) + '...' + key.substring(key.length - 4);
}

// Generic provider modal template
function getProviderModalContent(type, data = {}) {
    const isEdit = !!data['api-key'] || !!data.apiKey || !!data.name;
    const apiKey = data['api-key'] || data.apiKey || data.api_key || '';
    const prefix = data.prefix || '';
    const baseUrl = data['base-url'] || data.baseUrl || data.base_url || '';
    const proxyUrl = data['proxy-url'] || data.proxyUrl || data.proxy_url || '';
    const name = data.name || '';

    if (type === 'openai') {
        return `
            <div class="form-group">
                <label>Provider Name *</label>
                <input type="text" id="providerName" value="${escapeHtml(name)}" placeholder="openrouter, groq, etc.">
            </div>
            <div class="form-group">
                <label>Prefix (optional)</label>
                <input type="text" id="providerPrefix" value="${escapeHtml(prefix)}" placeholder="prefix for model routing">
            </div>
            <div class="form-group">
                <label>Base URL *</label>
                <input type="text" id="providerBaseUrl" value="${escapeHtml(baseUrl)}" placeholder="https://openrouter.ai/api/v1">
            </div>
            <div class="form-group">
                <label>API Key *</label>
                <input type="text" id="providerApiKey" value="${escapeHtml(apiKey)}" placeholder="sk-or-v1-...">
            </div>
            <div class="form-group">
                <label>Proxy URL (optional)</label>
                <input type="text" id="providerProxyUrl" value="${escapeHtml(proxyUrl)}" placeholder="socks5://proxy:1080">
            </div>
        `;
    }

    return `
        <div class="form-group">
            <label>API Key *</label>
            <input type="text" id="providerApiKey" value="${escapeHtml(apiKey)}" placeholder="${type === 'gemini' ? 'AIzaSy...' : 'sk-...'}">
        </div>
        <div class="form-group">
            <label>Prefix (optional)</label>
            <input type="text" id="providerPrefix" value="${escapeHtml(prefix)}" placeholder="prefix for model routing">
        </div>
        <div class="form-group">
            <label>Base URL (optional)</label>
            <input type="text" id="providerBaseUrl" value="${escapeHtml(baseUrl)}" placeholder="Custom API endpoint">
        </div>
        <div class="form-group">
            <label>Proxy URL (optional)</label>
            <input type="text" id="providerProxyUrl" value="${escapeHtml(proxyUrl)}" placeholder="socks5://proxy:1080">
        </div>
    `;
}

function collectProviderData(type) {
    const apiKey = document.getElementById('providerApiKey')?.value.trim();
    const prefix = document.getElementById('providerPrefix')?.value.trim();
    const baseUrl = document.getElementById('providerBaseUrl')?.value.trim();
    const proxyUrl = document.getElementById('providerProxyUrl')?.value.trim();
    const name = document.getElementById('providerName')?.value.trim();

    if (type === 'openai') {
        if (!name || !baseUrl || !apiKey) {
            throw new Error('Name, Base URL, and API Key are required');
        }
        const data = {
            name: name,
            'base-url': baseUrl,
            'api-key-entries': [{ 'api-key': apiKey }]
        };
        if (prefix) data.prefix = prefix;
        if (proxyUrl) data['api-key-entries'][0]['proxy-url'] = proxyUrl;
        return data;
    }

    if (!apiKey) {
        throw new Error('API Key is required');
    }

    const data = { 'api-key': apiKey };
    if (prefix) data.prefix = prefix;
    if (baseUrl) data['base-url'] = baseUrl;
    if (proxyUrl) data['proxy-url'] = proxyUrl;

    return data;
}

// Gemini
async function showAddGeminiModal() {
    showModal('Add Gemini Key', getProviderModalContent('gemini'), [
        { text: 'Cancel', class: 'btn-secondary', onclick: 'closeModal()' },
        { text: 'Add', class: 'btn', onclick: 'saveGeminiKey()' }
    ]);
}

async function showEditGeminiModal(idx) {
    const keys = await API.getGeminiKeys() || [];
    const key = keys[idx];
    if (!key) return;

    window._editingGeminiIdx = idx;
    window._editingGeminiKey = key;

    showModal('Edit Gemini Key', getProviderModalContent('gemini', key), [
        { text: 'Cancel', class: 'btn-secondary', onclick: 'closeModal()' },
        { text: 'Save', class: 'btn', onclick: 'updateGeminiKey()' }
    ]);
}

async function saveGeminiKey() {
    try {
        const data = collectProviderData('gemini');
        await API.addGeminiKey(data);
        closeModal();
        showAlert('Gemini key added successfully!', 'success');
        loadProviderTab('gemini');
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

async function updateGeminiKey() {
    try {
        const data = collectProviderData('gemini');
        await API.updateGeminiKey(data);
        closeModal();
        showAlert('Gemini key updated successfully!', 'success');
        loadProviderTab('gemini');
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

async function deleteGeminiKey(idx) {
    if (!confirm('Are you sure you want to delete this Gemini key?')) return;

    try {
        const keys = await API.getGeminiKeys() || [];
        const key = keys[idx];
        if (!key) return;

        await API.deleteGeminiKey(key['api-key'] || key.apiKey);
        showAlert('Gemini key deleted successfully!', 'success');
        loadProviderTab('gemini');
    } catch (error) {
        showAlert('Failed to delete: ' + error.message, 'error');
    }
}

// Claude
async function showAddClaudeModal() {
    showModal('Add Claude Key', getProviderModalContent('claude'), [
        { text: 'Cancel', class: 'btn-secondary', onclick: 'closeModal()' },
        { text: 'Add', class: 'btn', onclick: 'saveClaudeKey()' }
    ]);
}

async function showEditClaudeModal(idx) {
    const keys = await API.getClaudeKeys() || [];
    const key = keys[idx];
    if (!key) return;

    window._editingClaudeIdx = idx;
    window._editingClaudeKey = key;

    showModal('Edit Claude Key', getProviderModalContent('claude', key), [
        { text: 'Cancel', class: 'btn-secondary', onclick: 'closeModal()' },
        { text: 'Save', class: 'btn', onclick: 'updateClaudeKey()' }
    ]);
}

async function saveClaudeKey() {
    try {
        const data = collectProviderData('claude');
        await API.addClaudeKey(data);
        closeModal();
        showAlert('Claude key added successfully!', 'success');
        loadProviderTab('claude');
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

async function updateClaudeKey() {
    try {
        const data = collectProviderData('claude');
        await API.updateClaudeKey(data);
        closeModal();
        showAlert('Claude key updated successfully!', 'success');
        loadProviderTab('claude');
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

async function deleteClaudeKey(idx) {
    if (!confirm('Are you sure you want to delete this Claude key?')) return;

    try {
        const keys = await API.getClaudeKeys() || [];
        const key = keys[idx];
        if (!key) return;

        await API.deleteClaudeKey(key['api-key'] || key.apiKey);
        showAlert('Claude key deleted successfully!', 'success');
        loadProviderTab('claude');
    } catch (error) {
        showAlert('Failed to delete: ' + error.message, 'error');
    }
}

// Codex
async function showAddCodexModal() {
    showModal('Add Codex Key', getProviderModalContent('codex'), [
        { text: 'Cancel', class: 'btn-secondary', onclick: 'closeModal()' },
        { text: 'Add', class: 'btn', onclick: 'saveCodexKey()' }
    ]);
}

async function showEditCodexModal(idx) {
    const keys = await API.getCodexKeys() || [];
    const key = keys[idx];
    if (!key) return;

    showModal('Edit Codex Key', getProviderModalContent('codex', key), [
        { text: 'Cancel', class: 'btn-secondary', onclick: 'closeModal()' },
        { text: 'Save', class: 'btn', onclick: 'updateCodexKey()' }
    ]);
}

async function saveCodexKey() {
    try {
        const data = collectProviderData('codex');
        await API.addCodexKey(data);
        closeModal();
        showAlert('Codex key added successfully!', 'success');
        loadProviderTab('codex');
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

async function updateCodexKey() {
    try {
        const data = collectProviderData('codex');
        await API.updateCodexKey(data);
        closeModal();
        showAlert('Codex key updated successfully!', 'success');
        loadProviderTab('codex');
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

async function deleteCodexKey(idx) {
    if (!confirm('Are you sure you want to delete this Codex key?')) return;

    try {
        const keys = await API.getCodexKeys() || [];
        const key = keys[idx];
        if (!key) return;

        await API.deleteCodexKey(key['api-key'] || key.apiKey);
        showAlert('Codex key deleted successfully!', 'success');
        loadProviderTab('codex');
    } catch (error) {
        showAlert('Failed to delete: ' + error.message, 'error');
    }
}

// Vertex
async function showAddVertexModal() {
    showModal('Add Vertex Key', getProviderModalContent('vertex'), [
        { text: 'Cancel', class: 'btn-secondary', onclick: 'closeModal()' },
        { text: 'Add', class: 'btn', onclick: 'saveVertexKey()' }
    ]);
}

async function showEditVertexModal(idx) {
    const keys = await API.getVertexKeys() || [];
    const key = keys[idx];
    if (!key) return;

    showModal('Edit Vertex Key', getProviderModalContent('vertex', key), [
        { text: 'Cancel', class: 'btn-secondary', onclick: 'closeModal()' },
        { text: 'Save', class: 'btn', onclick: 'updateVertexKey()' }
    ]);
}

async function saveVertexKey() {
    try {
        const data = collectProviderData('vertex');
        await API.addVertexKey(data);
        closeModal();
        showAlert('Vertex key added successfully!', 'success');
        loadProviderTab('vertex');
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

async function updateVertexKey() {
    try {
        const data = collectProviderData('vertex');
        await API.updateVertexKey(data);
        closeModal();
        showAlert('Vertex key updated successfully!', 'success');
        loadProviderTab('vertex');
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

async function deleteVertexKey(idx) {
    if (!confirm('Are you sure you want to delete this Vertex key?')) return;

    try {
        const keys = await API.getVertexKeys() || [];
        const key = keys[idx];
        if (!key) return;

        await API.deleteVertexKey(key['api-key'] || key.apiKey);
        showAlert('Vertex key deleted successfully!', 'success');
        loadProviderTab('vertex');
    } catch (error) {
        showAlert('Failed to delete: ' + error.message, 'error');
    }
}

// OpenAI Compatible
async function showAddOpenAIModal() {
    showModal('Add OpenAI Compatible Provider', getProviderModalContent('openai'), [
        { text: 'Cancel', class: 'btn-secondary', onclick: 'closeModal()' },
        { text: 'Add', class: 'btn', onclick: 'saveOpenAICompat()' }
    ]);
}

async function showEditOpenAIModal(idx) {
    const providers = await API.getOpenAICompat() || [];
    const provider = providers[idx];
    if (!provider) return;

    // Extract the first API key entry for display
    const apiKeyEntry = provider['api-key-entries']?.[0] || {};
    const displayData = {
        ...provider,
        'api-key': apiKeyEntry['api-key'] || '',
        'proxy-url': apiKeyEntry['proxy-url'] || ''
    };

    window._editingOpenAIIdx = idx;
    window._editingOpenAIProvider = provider;

    showModal('Edit OpenAI Compatible Provider', getProviderModalContent('openai', displayData), [
        { text: 'Cancel', class: 'btn-secondary', onclick: 'closeModal()' },
        { text: 'Save', class: 'btn', onclick: 'updateOpenAICompat()' }
    ]);
}

async function saveOpenAICompat() {
    try {
        const data = collectProviderData('openai');
        await API.addOpenAICompat(data);
        closeModal();
        showAlert('OpenAI compatible provider added successfully!', 'success');
        loadProviderTab('openai');
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

async function updateOpenAICompat() {
    try {
        const data = collectProviderData('openai');
        await API.updateOpenAICompat(data);
        closeModal();
        showAlert('OpenAI compatible provider updated successfully!', 'success');
        loadProviderTab('openai');
    } catch (error) {
        showAlert(error.message, 'error');
    }
}

async function deleteOpenAICompat(idx) {
    if (!confirm('Are you sure you want to delete this provider?')) return;

    try {
        const providers = await API.getOpenAICompat() || [];
        const provider = providers[idx];
        if (!provider) return;

        await API.deleteOpenAICompat(provider.name);
        showAlert('Provider deleted successfully!', 'success');
        loadProviderTab('openai');
    } catch (error) {
        showAlert('Failed to delete: ' + error.message, 'error');
    }
}
