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
    const canReauth = canReauthenticate(fileType);

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
                    ${canReauth ? `<button class="btn btn-primary btn-sm" onclick="reAuthenticate('${escapeHtml(fileType)}', '${escapeHtml(fileName)}')">Re-authenticate</button>` : ''}
                    <button class="btn btn-secondary btn-sm" onclick="viewAuthFileModels('${escapeHtml(fileName)}')">Models</button>
                    <button class="btn btn-secondary btn-sm" onclick="downloadAuthFile('${escapeHtml(fileName)}')">Download</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteAuthFile('${escapeHtml(fileName)}')">Delete</button>
                ` : `
                    ${canReauth ? `<button class="btn btn-primary btn-sm" onclick="reAuthenticate('${escapeHtml(fileType)}', '${escapeHtml(fileName)}')">Re-authenticate</button>` : ''}
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

// Check if a provider type supports re-authentication
function canReauthenticate(fileType) {
    const normalizedType = (fileType || '').toLowerCase();
    const supportedProviders = ['copilot', 'claude', 'codex', 'gemini', 'gemini-cli', 'antigravity', 'qwen'];
    return supportedProviders.some(p => normalizedType.includes(p));
}

// Re-authenticate an auth file by starting the appropriate OAuth flow
async function reAuthenticate(fileType, fileName) {
    const normalizedType = (fileType || '').toLowerCase();

    // Show confirmation (use window.confirm to avoid recursion with custom confirm wrapper)
    if (!window.confirm(`Re-authenticate ${fileName}?\n\nThis will start a new OAuth flow for ${fileType}.`)) {
        return;
    }

    try {
        if (normalizedType.includes('copilot')) {
            await startCopilotReauth();
        } else if (normalizedType.includes('claude') || normalizedType === 'anthropic') {
            await startProviderReauth('anthropic', 'Anthropic');
        } else if (normalizedType.includes('codex')) {
            await startProviderReauth('codex', 'Codex');
        } else if (normalizedType.includes('gemini')) {
            await startGeminiReauth();
        } else if (normalizedType.includes('antigravity')) {
            await startProviderReauth('antigravity', 'Antigravity');
        } else if (normalizedType.includes('qwen')) {
            await startProviderReauth('qwen', 'Qwen');
        } else {
            showAlert(`Re-authentication not supported for ${fileType}`, 'warning');
        }
    } catch (error) {
        showAlert('Failed to start re-authentication: ' + error.message, 'error');
    }
}

// Start Copilot re-authentication with modal
async function startCopilotReauth() {
    try {
        const response = await API.requestCopilotAuth();

        if (response.device_code && response.verification_uri) {
            const userCode = response.user_code;
            const verificationUri = response.verification_uri;
            const deviceCode = response.device_code;
            const expiresIn = response.expires_in || 900;
            const interval = response.interval || 5;

            // Show modal with device code
            showModal('GitHub Copilot Re-authentication', `
                <div class="device-code-box" style="text-align: center; padding: 20px;">
                    <div class="device-code-hint" style="margin-bottom: 10px;">Enter this code at GitHub:</div>
                    <div class="device-code" style="font-size: 32px; font-weight: bold; letter-spacing: 4px; padding: 20px; background: var(--bg-tertiary); border-radius: 8px; margin-bottom: 20px;">${escapeHtml(userCode)}</div>
                    <div style="margin-bottom: 20px;">
                        <a href="${escapeHtml(verificationUri)}" target="_blank" class="btn">Open GitHub</a>
                        <button class="btn btn-secondary" onclick="navigator.clipboard.writeText('${escapeHtml(userCode)}'); showAlert('Code copied!', 'success')">Copy Code</button>
                    </div>
                    <div id="copilotReauthStatus" class="oauth-status waiting">
                        Waiting for authentication... (expires in ${Math.floor(expiresIn / 60)} minutes)
                    </div>
                </div>
            `);

            // Start polling
            let pollCount = 0;
            const maxPolls = Math.floor(expiresIn / interval);

            const pollInterval = setInterval(async () => {
                pollCount++;

                if (pollCount > maxPolls) {
                    clearInterval(pollInterval);
                    const statusEl = document.getElementById('copilotReauthStatus');
                    if (statusEl) {
                        statusEl.className = 'oauth-status error';
                        statusEl.textContent = 'Authentication timed out. Please close and try again.';
                    }
                    return;
                }

                try {
                    const status = await API.getCopilotTokenStatus(deviceCode);

                    if (status.status === 'ok') {
                        clearInterval(pollInterval);
                        const statusEl = document.getElementById('copilotReauthStatus');
                        if (statusEl) {
                            statusEl.className = 'oauth-status success';
                            statusEl.textContent = 'Authentication successful!';
                        }
                        showAlert('GitHub Copilot re-authentication successful!', 'success');
                        setTimeout(() => {
                            closeModal();
                            renderAuthFiles(document.getElementById('pageContent'));
                        }, 1500);
                    } else if (status.status === 'error') {
                        clearInterval(pollInterval);
                        const statusEl = document.getElementById('copilotReauthStatus');
                        if (statusEl) {
                            statusEl.className = 'oauth-status error';
                            statusEl.textContent = status.error || 'Authentication failed. Please try again.';
                        }
                    } else {
                        const statusEl = document.getElementById('copilotReauthStatus');
                        if (statusEl) {
                            statusEl.textContent = `Waiting for authentication... (${Math.floor((expiresIn - pollCount * interval) / 60)} min remaining)`;
                        }
                    }
                } catch (pollError) {
                    console.error('Copilot reauth poll error:', pollError);
                }
            }, interval * 1000);

        } else {
            showAlert('Failed to start Copilot authentication: No device code received', 'error');
        }
    } catch (error) {
        showAlert('Failed to start Copilot re-authentication: ' + error.message, 'error');
    }
}

// Start provider re-authentication (Anthropic, Codex, Antigravity, Qwen)
async function startProviderReauth(provider, displayName) {
    try {
        let response;
        if (provider === 'anthropic') response = await API.requestAnthropicAuth();
        else if (provider === 'codex') response = await API.requestCodexAuth();
        else if (provider === 'antigravity') response = await API.requestAntigravityAuth();
        else if (provider === 'qwen') response = await API.requestQwenAuth();

        if (response && response.url) {
            window.open(response.url, '_blank');
            showAlert(`${displayName} re-authentication started. Please complete in the new window.`, 'info');

            if (response.state) {
                pollReauthStatus(response.state, displayName);
            }
        } else {
            showAlert(`Failed to start ${displayName} re-authentication: No URL received`, 'error');
        }
    } catch (error) {
        showAlert(`Failed to start ${displayName} re-authentication: ` + error.message, 'error');
    }
}

// Start Gemini re-authentication
async function startGeminiReauth() {
    try {
        const response = await API.requestGeminiAuth();

        if (response && response.url) {
            window.open(response.url, '_blank');
            showAlert('Gemini re-authentication started. Please complete in the new window.', 'info');

            if (response.state) {
                pollReauthStatus(response.state, 'Gemini');
            }
        } else {
            showAlert('Failed to start Gemini re-authentication: No URL received', 'error');
        }
    } catch (error) {
        showAlert('Failed to start Gemini re-authentication: ' + error.message, 'error');
    }
}

// Poll for re-authentication status
async function pollReauthStatus(state, providerName) {
    const maxAttempts = 60;
    let attempts = 0;

    const poll = async () => {
        attempts++;
        try {
            const status = await API.getAuthStatus(state);
            if (status.status === 'ok') {
                showAlert(`${providerName} re-authentication successful!`, 'success');
                renderAuthFiles(document.getElementById('pageContent'));
                return;
            } else if (status.status === 'error') {
                showAlert(`${providerName} re-authentication failed: ` + (status.error || 'Unknown error'), 'error');
                return;
            }

            if (attempts < maxAttempts) {
                setTimeout(poll, 2000);
            } else {
                showAlert(`${providerName} re-authentication timed out`, 'warning');
            }
        } catch (error) {
            console.error('Reauth poll error:', error);
            if (attempts < maxAttempts) {
                setTimeout(poll, 2000);
            }
        }
    };

    poll();
}
