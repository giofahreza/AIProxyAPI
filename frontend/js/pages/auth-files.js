// Auth Files Page

async function renderAuthFiles(container) {
    try {
        const response = await API.listAuthFiles();
        // API returns { files: [...] } object, extract the files array
        const files = response?.files || response || [];
        const filesList = Array.isArray(files) ? files : [];

        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Authentication Files</h2>
                    <button class="btn btn-secondary btn-sm" onclick="renderAuthFiles(document.getElementById('pageContent'))">Refresh</button>
                </div>
                <div class="card-body">
                    <div id="authFilesAlert"></div>

                    <div class="section-header">
                        <h3 class="section-title">Upload New Auth File</h3>
                        <p class="section-description">Upload JSON credential files for OAuth providers</p>
                    </div>
                    <div class="flex flex-gap mb-20">
                        <input type="file" id="authFileInput" accept=".json" multiple>
                        <button class="btn" onclick="uploadAuthFile()">Upload</button>
                    </div>

                    <div class="section-header">
                        <h3 class="section-title">Import Vertex Credential</h3>
                        <p class="section-description">Paste Google Cloud service account JSON content</p>
                    </div>
                    <div class="mb-20">
                        <textarea id="vertexCredentialContent" rows="4" placeholder='{"type": "service_account", "project_id": "...", ...}'></textarea>
                        <button class="btn mt-20" onclick="importVertexCredential()">Import Vertex Credential</button>
                    </div>

                    <div class="section-header">
                        <h3 class="section-title">Existing Auth Files (${filesList.length})</h3>
                    </div>
                    ${filesList.length === 0 ? `
                        <div class="empty-state">
                            <div class="empty-state-title">No auth files found</div>
                            <div class="empty-state-description">Upload credential files to get started</div>
                        </div>
                    ` : `
                        <div id="authFilesList">
                            ${filesList.map(file => renderAuthFileCard(file)).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;
    } catch (error) {
        showError(container, 'Failed to load auth files: ' + error.message);
    }
}

function renderAuthFileCard(file) {
    const typeClass = getFileTypeClass(file.type || file.provider || 'unknown');
    const fileName = file.name || 'Unknown';
    const fileType = file.type || file.provider || 'unknown';
    const modified = formatDate(file.modtime || file.modified_time || file.modified);
    const size = file.size ? formatFileSize(file.size) : '-';
    const isRuntime = file.runtime_only || file.runtimeOnly;

    return `
        <div class="file-card">
            <div class="file-info">
                <span class="file-type ${typeClass}">${escapeHtml(fileType)}</span>
                <div>
                    <div class="file-name">${escapeHtml(fileName)}</div>
                    <div class="file-meta">Size: ${size} | Modified: ${modified}${isRuntime ? ' | <span class="text-muted">Runtime</span>' : ''}</div>
                </div>
            </div>
            <div class="file-actions">
                ${!isRuntime ? `
                    <button class="btn btn-secondary btn-sm" onclick="viewAuthFileModels('${escapeHtml(fileName)}')">Models</button>
                    <button class="btn btn-secondary btn-sm" onclick="downloadAuthFile('${escapeHtml(fileName)}')">Download</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteAuthFile('${escapeHtml(fileName)}')">Delete</button>
                ` : `
                    <button class="btn btn-secondary btn-sm" onclick="viewAuthFileModels('${escapeHtml(fileName)}')">Models</button>
                    <span class="badge badge-info">Virtual</span>
                `}
            </div>
        </div>
    `;
}

function getFileTypeClass(type) {
    const normalizedType = (type || '').toLowerCase();
    const knownTypes = ['gemini', 'claude', 'codex', 'vertex', 'qwen', 'iflow', 'antigravity', 'aistudio', 'gemini-cli'];
    return knownTypes.includes(normalizedType) ? normalizedType.replace('-', '') : 'unknown';
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function uploadAuthFile() {
    const input = document.getElementById('authFileInput');
    if (!input.files || input.files.length === 0) {
        showAlert('Please select a file', 'error');
        return;
    }

    try {
        let successCount = 0;
        let failCount = 0;

        for (const file of input.files) {
            try {
                await API.uploadAuthFile(file);
                successCount++;
            } catch (e) {
                failCount++;
                console.error('Failed to upload', file.name, e);
            }
        }

        if (successCount > 0) {
            showAlert(`Uploaded ${successCount} file(s) successfully!${failCount > 0 ? ` (${failCount} failed)` : ''}`, failCount > 0 ? 'warning' : 'success');
        } else {
            showAlert('Failed to upload files', 'error');
        }

        input.value = '';
        renderAuthFiles(document.getElementById('pageContent'));
    } catch (error) {
        showAlert('Failed to upload: ' + error.message, 'error');
    }
}

async function importVertexCredential() {
    const content = document.getElementById('vertexCredentialContent').value.trim();
    if (!content) {
        showAlert('Please paste the credential JSON content', 'error');
        return;
    }

    try {
        // Validate JSON
        JSON.parse(content);
        await API.importVertexCredential(content);
        showAlert('Vertex credential imported successfully!', 'success');
        document.getElementById('vertexCredentialContent').value = '';
        renderAuthFiles(document.getElementById('pageContent'));
    } catch (error) {
        if (error instanceof SyntaxError) {
            showAlert('Invalid JSON format', 'error');
        } else {
            showAlert('Failed to import: ' + error.message, 'error');
        }
    }
}

async function viewAuthFileModels(filename) {
    try {
        const models = await API.getAuthFileModels(filename);
        const modelsList = Array.isArray(models) ? models : (models?.models || []);

        showModal('Models for ' + filename, `
            <div class="section-description mb-20">
                Available models for this credential file
            </div>
            ${modelsList.length === 0 ? `
                <div class="empty-state">
                    <div class="empty-state-title">No models found</div>
                    <div class="empty-state-description">This credential may not be loaded yet or has no associated models</div>
                </div>
            ` : `
                <div class="models-grid">
                    ${modelsList.map(model => `
                        <div class="model-tag" onclick="navigator.clipboard.writeText('${escapeHtml(model.id || model.name || model)}'); showAlert('Copied!', 'success')">
                            ${escapeHtml(model.display_name || model.id || model.name || model)}
                        </div>
                    `).join('')}
                </div>
            `}
        `);
    } catch (error) {
        if (error.message.includes('404') || error.message.includes('not found')) {
            showAlert('Models API not supported by this server version', 'warning');
        } else {
            showAlert('Failed to load models: ' + error.message, 'error');
        }
    }
}

async function downloadAuthFile(filename) {
    try {
        const content = await API.downloadAuthFile(filename);
        const blob = new Blob([typeof content === 'string' ? content : JSON.stringify(content, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        showAlert('Downloaded ' + filename, 'success');
    } catch (error) {
        showAlert('Failed to download: ' + error.message, 'error');
    }
}

async function deleteAuthFile(filename) {
    if (!confirm(`Are you sure you want to delete ${filename}?`)) return;

    try {
        await API.deleteAuthFile(filename);
        showAlert('Auth file deleted successfully!', 'success');
        renderAuthFiles(document.getElementById('pageContent'));
    } catch (error) {
        showAlert('Failed to delete: ' + error.message, 'error');
    }
}
