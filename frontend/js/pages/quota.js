// Quota Management Page

async function renderQuota(container) {
    try {
        const config = await API.getConfig();

        // API uses kebab-case keys
        const quotaExceeded = config['quota-exceeded'] || config.quota_exceeded || {};
        const switchProject = quotaExceeded['switch-project'] ?? quotaExceeded.switch_project ?? false;
        const switchPreviewModel = quotaExceeded['switch-preview-model'] ?? quotaExceeded.switch_preview_model ?? false;

        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Quota Management</h2>
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

        // Setup event listeners
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

    } catch (error) {
        showError(container, 'Failed to load quota settings: ' + error.message);
    }
}

async function saveQuotaSettings() {
    showAlert('Settings saved successfully!', 'success');
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
