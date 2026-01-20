// API Keys Page

async function renderAPIKeys(container) {
    try {
        const data = await API.getAPIKeys();
        const keys = data.api_keys || data.apiKeys || data['api-keys'] || [];

        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">API Keys</h2>
                    <button class="btn btn-success" onclick="showAddAPIKeyDialog()">Add API Key</button>
                </div>
                <div class="card-body">
                    <div id="apiKeysAlert"></div>
                    ${keys.length === 0 ? '<p class="text-center">No API keys configured</p>' : `
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>API Key</th>
                                    <th width="150">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${keys.map(key => `
                                    <tr>
                                        <td><code>${escapeHtml(key)}</code></td>
                                        <td>
                                            <button class="btn btn-primary btn-sm" onclick="editAPIKey('${escapeHtml(key).replace(/'/g, "\\'")}')">Edit</button>
                                            <button class="btn btn-danger btn-sm" onclick="deleteAPIKey('${escapeHtml(key).replace(/'/g, "\\'")}')">Delete</button>
                                        </td>
                                    </tr>
                                `).join('')}
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
            <label for="newApiKey">API Key</label>
            <input type="text" id="newApiKey" placeholder="your-api-key">
        </div>
    `, async () => {
        const key = document.getElementById('newApiKey').value.trim();
        if (!key) {
            alert('Please enter an API key');
            return;
        }

        try {
            await API.addAPIKey(key);
            showAlert('API key added successfully', 'success');
            renderAPIKeys(document.getElementById('pageContent'));
        } catch (error) {
            showAlert('Failed to add API key: ' + error.message, 'error');
        }
    });
}

function editAPIKey(oldKey) {
    showModal('Edit API Key', `
        <div class="form-group">
            <label for="editApiKey">API Key</label>
            <input type="text" id="editApiKey" value="${escapeHtml(oldKey)}" placeholder="your-api-key">
        </div>
    `, async () => {
        const newKey = document.getElementById('editApiKey').value.trim();
        if (!newKey) {
            alert('Please enter an API key');
            return;
        }

        try {
            await API.patch('/api-keys', { old: oldKey, new: newKey });
            showAlert('API key updated successfully', 'success');
            renderAPIKeys(document.getElementById('pageContent'));
        } catch (error) {
            showAlert('Failed to update API key: ' + error.message, 'error');
        }
    });
}

async function deleteAPIKey(key) {
    if (!confirm(`Are you sure you want to delete this API key?`)) return;

    try {
        await API.deleteAPIKey(key);
        showAlert('API key deleted successfully', 'success');
        renderAPIKeys(document.getElementById('pageContent'));
    } catch (error) {
        showAlert('Failed to delete API key: ' + error.message, 'error');
    }
}
