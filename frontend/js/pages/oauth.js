// OAuth Page

async function renderOAuth(container) {
    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h2 class="card-title">OAuth Authentication</h2>
            </div>
            <div class="card-body">
                <div id="oauthAlert"></div>

                <h3>Start OAuth Flow</h3>
                <div class="grid-2 mb-20">
                    <button class="btn" onclick="startOAuth('anthropic')">Anthropic (Claude)</button>
                    <button class="btn" onclick="startOAuth('codex')">Codex</button>
                    <button class="btn" onclick="startOAuth('gemini')">Gemini CLI</button>
                    <button class="btn" onclick="startOAuth('antigravity')">Antigravity</button>
                    <button class="btn" onclick="startOAuth('qwen')">Qwen</button>
                    <button class="btn" onclick="startOAuth('copilot')">GitHub Copilot</button>
                </div>

                <h3>Manual Token Submission</h3>
                <div class="form-group">
                    <label for="copilotToken">GitHub Copilot Token</label>
                    <input type="text" id="copilotToken" placeholder="ghu_...">
                    <button class="btn mt-20" onclick="submitCopilotToken()">Submit Copilot Token</button>
                </div>

                <div class="form-group">
                    <label for="iflowCookie">iFlow Cookie</label>
                    <textarea id="iflowCookie" rows="3" placeholder="cookie string"></textarea>
                    <button class="btn mt-20" onclick="submitIFlowCookie()">Submit iFlow Cookie</button>
                </div>
            </div>
        </div>
    `;
}

async function startOAuth(provider) {
    try {
        let response;
        if (provider === 'anthropic') response = await API.requestAnthropicAuth();
        else if (provider === 'codex') response = await API.requestCodexAuth();
        else if (provider === 'gemini') response = await API.requestGeminiAuth();
        else if (provider === 'antigravity') response = await API.requestAntigravityAuth();
        else if (provider === 'qwen') response = await API.requestQwenAuth();
        else if (provider === 'copilot') response = await API.requestCopilotAuth();

        if (response.url) {
            window.open(response.url, '_blank');
            showAlert(`OAuth flow started. Please complete authentication in the new window.`, 'info');

            if (response.state) {
                pollAuthStatus(response.state);
            }
        }
    } catch (error) {
        showAlert('Failed to start OAuth: ' + error.message, 'error');
    }
}

async function pollAuthStatus(state) {
    const maxAttempts = 60;
    let attempts = 0;

    const poll = async () => {
        attempts++;
        try {
            const status = await API.getAuthStatus(state);
            if (status.status === 'ok') {
                showAlert('OAuth authentication successful!', 'success');
                return;
            } else if (status.status === 'error') {
                showAlert('OAuth authentication failed: ' + (status.error || 'Unknown error'), 'error');
                return;
            }

            if (attempts < maxAttempts) {
                setTimeout(poll, 2000);
            } else {
                showAlert('OAuth authentication timed out', 'warning');
            }
        } catch (error) {
            console.error('Poll error:', error);
        }
    };

    poll();
}

async function submitCopilotToken() {
    const token = document.getElementById('copilotToken').value.trim();
    if (!token) {
        showAlert('Please enter a token', 'error');
        return;
    }

    try {
        await API.submitCopilotToken(token);
        showAlert('Copilot token submitted successfully!', 'success');
        document.getElementById('copilotToken').value = '';
    } catch (error) {
        showAlert('Failed to submit token: ' + error.message, 'error');
    }
}

async function submitIFlowCookie() {
    const cookie = document.getElementById('iflowCookie').value.trim();
    if (!cookie) {
        showAlert('Please enter a cookie', 'error');
        return;
    }

    try {
        await API.submitIFlowCookie(cookie);
        showAlert('iFlow cookie submitted successfully!', 'success');
        document.getElementById('iflowCookie').value = '';
    } catch (error) {
        showAlert('Failed to submit cookie: ' + error.message, 'error');
    }
}
