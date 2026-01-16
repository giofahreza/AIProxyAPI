// Config YAML Page

async function renderConfig(container) {
    try {
        const yaml = await API.getConfigYAML();

        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Configuration (YAML)</h2>
                    <div>
                        <button class="btn btn-secondary" onclick="reloadConfigYAML()">Reload</button>
                        <button class="btn btn-success" onclick="saveConfigYAML()">Save</button>
                    </div>
                </div>
                <div class="card-body">
                    <div id="configAlert"></div>
                    <p class="alert alert-warning">
                        <strong>Warning:</strong> Direct YAML editing can break your configuration if syntax is invalid. Make sure you know what you're doing!
                    </p>
                    <div class="form-group">
                        <label for="configYaml">config.yaml</label>
                        <textarea id="configYaml" rows="30" style="font-family: 'Courier New', monospace;">${escapeHtml(yaml)}</textarea>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        showError(container, 'Failed to load configuration: ' + error.message);
    }
}

async function reloadConfigYAML() {
    renderConfig(document.getElementById('pageContent'));
    showAlert('Configuration reloaded', 'info');
}

async function saveConfigYAML() {
    const alertDiv = document.getElementById('configAlert');
    try {
        const yaml = document.getElementById('configYaml').value;
        await API.saveConfigYAML(yaml);
        alertDiv.innerHTML = '<div class="alert alert-success">Configuration saved successfully! Changes will take effect after server restart.</div>';
        await App.refreshConfig();
    } catch (error) {
        alertDiv.innerHTML = `<div class="alert alert-error">Failed to save: ${escapeHtml(error.message)}</div>`;
    }
}
