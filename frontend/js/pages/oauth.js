// OAuth Page

let copilotPollingInterval = null;

async function renderOAuth(container) {
    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h2 class="card-title">OAuth Authentication</h2>
            </div>
            <div class="card-body">
                <div id="oauthAlert"></div>

                <div class="section-header">
                    <h3 class="section-title">Start OAuth Flow</h3>
                    <p class="section-description">Click to start the OAuth authentication process for each provider</p>
                </div>

                <div class="grid-3 mb-20">
                    <div class="oauth-card">
                        <div class="oauth-title">Anthropic (Claude)</div>
                        <div class="oauth-description">Authenticate with your Claude account</div>
                        <button class="btn btn-block" onclick="startOAuth('anthropic')">Login with Anthropic</button>
                    </div>

                    <div class="oauth-card">
                        <div class="oauth-title">Codex</div>
                        <div class="oauth-description">Authenticate with Codex service</div>
                        <button class="btn btn-block" onclick="startOAuth('codex')">Login with Codex</button>
                    </div>

                    <div class="oauth-card">
                        <div class="oauth-title">Gemini CLI</div>
                        <div class="oauth-description">Authenticate with Google Gemini</div>
                        <div class="form-group mb-20">
                            <input type="text" id="geminiProjectId" placeholder="Project ID (optional)">
                        </div>
                        <button class="btn btn-block" onclick="startGeminiOAuth()">Login with Gemini</button>
                    </div>

                    <div class="oauth-card">
                        <div class="oauth-title">Antigravity</div>
                        <div class="oauth-description">Authenticate with Antigravity</div>
                        <button class="btn btn-block" onclick="startOAuth('antigravity')">Login with Antigravity</button>
                    </div>

                    <div class="oauth-card">
                        <div class="oauth-title">Qwen</div>
                        <div class="oauth-description">Authenticate with Qwen service</div>
                        <button class="btn btn-block" onclick="startOAuth('qwen')">Login with Qwen</button>
                    </div>

                    <div class="oauth-card" id="copilotOAuthCard">
                        <div class="oauth-title">GitHub Copilot</div>
                        <div class="oauth-description">Authenticate with GitHub Copilot (Device Flow)</div>
                        <button class="btn btn-block" id="copilotOAuthBtn" onclick="startCopilotOAuth()">Login with GitHub</button>
                        <div id="copilotDeviceCode" class="hidden"></div>
                    </div>
                </div>

                <div class="section-header">
                    <h3 class="section-title">Manual Token Submission</h3>
                    <p class="section-description">Manually submit tokens if OAuth flow doesn't work</p>
                </div>

                <div class="grid-2">
                    <div class="oauth-card">
                        <div class="oauth-title">GitHub Copilot Token</div>
                        <div class="form-group">
                            <input type="text" id="copilotToken" placeholder="ghu_...">
                        </div>
                        <div class="form-group">
                            <input type="email" id="copilotEmail" placeholder="Email (optional)">
                        </div>
                        <button class="btn" onclick="submitCopilotToken()">Submit Copilot Token</button>
                    </div>

                    <div class="oauth-card">
                        <div class="oauth-title">iFlow Cookie</div>
                        <div class="form-group">
                            <textarea id="iflowCookie" rows="3" placeholder="Cookie string from browser"></textarea>
                        </div>
                        <button class="btn" onclick="submitIFlowCookie()">Submit iFlow Cookie</button>
                    </div>
                </div>

                <div class="section-header mt-20">
                    <h3 class="section-title">OAuth Callback</h3>
                    <p class="section-description">Submit OAuth redirect URL if automatic callback doesn't work</p>
                </div>

                <div class="oauth-card">
                    <div class="form-group">
                        <label>Provider</label>
                        <select id="callbackProvider">
                            <option value="anthropic">Anthropic</option>
                            <option value="codex">Codex</option>
                            <option value="gemini">Gemini</option>
                            <option value="antigravity">Antigravity</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Redirect URL</label>
                        <input type="text" id="callbackUrl" placeholder="http://localhost:54545/callback?code=...">
                    </div>
                    <button class="btn" onclick="submitOAuthCallback()">Submit Callback</button>
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
        else if (provider === 'antigravity') response = await API.requestAntigravityAuth();
        else if (provider === 'qwen') response = await API.requestQwenAuth();

        if (response.url) {
            window.open(response.url, '_blank');
            showAlert(`OAuth flow started for ${provider}. Please complete authentication in the new window.`, 'info');

            if (response.state) {
                pollAuthStatus(response.state);
            }
        } else {
            showAlert('OAuth response did not contain a URL', 'error');
        }
    } catch (error) {
        showAlert('Failed to start OAuth: ' + error.message, 'error');
    }
}

async function startGeminiOAuth() {
    try {
        const projectId = document.getElementById('geminiProjectId')?.value.trim();
        const response = await API.requestGeminiAuth(projectId || undefined);

        if (response.url) {
            window.open(response.url, '_blank');
            showAlert('Gemini OAuth flow started. Please complete authentication in the new window.', 'info');

            if (response.state) {
                pollAuthStatus(response.state);
            }
        } else {
            showAlert('OAuth response did not contain a URL', 'error');
        }
    } catch (error) {
        showAlert('Failed to start Gemini OAuth: ' + error.message, 'error');
    }
}

async function startCopilotOAuth() {
    // Stop any existing polling
    if (copilotPollingInterval) {
        clearInterval(copilotPollingInterval);
        copilotPollingInterval = null;
    }

    try {
        const response = await API.requestCopilotAuth();

        // GitHub Copilot uses device code flow
        if (response.device_code && response.verification_uri) {
            const userCode = response.user_code;
            const verificationUri = response.verification_uri;
            const deviceCode = response.device_code;
            const expiresIn = response.expires_in || 900;
            const interval = response.interval || 5;

            // Show device code to user
            const deviceCodeDiv = document.getElementById('copilotDeviceCode');
            deviceCodeDiv.classList.remove('hidden');
            deviceCodeDiv.innerHTML = `
                <div class="device-code-box">
                    <div class="device-code-hint">Enter this code at GitHub:</div>
                    <div class="device-code">${escapeHtml(userCode)}</div>
                    <div class="device-code-hint mt-20">
                        <a href="${escapeHtml(verificationUri)}" target="_blank" class="btn btn-secondary btn-sm">Open GitHub</a>
                    </div>
                </div>
                <div class="oauth-status waiting" id="copilotStatus">
                    Waiting for authentication... (expires in ${Math.floor(expiresIn / 60)} minutes)
                </div>
            `;

            // Disable the login button while polling
            document.getElementById('copilotOAuthBtn').disabled = true;
            document.getElementById('copilotOAuthBtn').textContent = 'Waiting...';

            // Start polling for token
            let pollCount = 0;
            const maxPolls = Math.floor(expiresIn / interval);

            copilotPollingInterval = setInterval(async () => {
                pollCount++;

                if (pollCount > maxPolls) {
                    clearInterval(copilotPollingInterval);
                    copilotPollingInterval = null;
                    document.getElementById('copilotStatus').className = 'oauth-status error';
                    document.getElementById('copilotStatus').textContent = 'Authentication timed out. Please try again.';
                    document.getElementById('copilotOAuthBtn').disabled = false;
                    document.getElementById('copilotOAuthBtn').textContent = 'Login with GitHub';
                    return;
                }

                try {
                    const status = await API.getCopilotTokenStatus(deviceCode);
                    console.log('Copilot poll status:', status);

                    if (status.status === 'ok') {
                        // Success!
                        clearInterval(copilotPollingInterval);
                        copilotPollingInterval = null;
                        document.getElementById('copilotStatus').className = 'oauth-status success';
                        document.getElementById('copilotStatus').textContent = 'Authentication successful!';
                        document.getElementById('copilotOAuthBtn').disabled = false;
                        document.getElementById('copilotOAuthBtn').textContent = 'Login with GitHub';
                        showAlert('GitHub Copilot authentication successful!', 'success');
                    } else if (status.status === 'wait') {
                        // Still waiting, continue polling
                        document.getElementById('copilotStatus').textContent =
                            `Waiting for authentication... (${Math.floor((expiresIn - pollCount * interval) / 60)} min remaining)`;
                    } else if (status.status === 'error') {
                        // Error occurred
                        clearInterval(copilotPollingInterval);
                        copilotPollingInterval = null;
                        document.getElementById('copilotStatus').className = 'oauth-status error';
                        document.getElementById('copilotStatus').textContent = status.error || 'Authentication failed. Please try again.';
                        document.getElementById('copilotOAuthBtn').disabled = false;
                        document.getElementById('copilotOAuthBtn').textContent = 'Login with GitHub';
                    }
                } catch (pollError) {
                    console.error('Copilot poll error:', pollError);
                    // Continue polling on errors
                }
            }, interval * 1000);

        } else if (response.url) {
            // Fallback to URL-based flow
            window.open(response.url, '_blank');
            showAlert('GitHub OAuth flow started. Please complete authentication in the new window.', 'info');
        } else {
            showAlert('Copilot OAuth failed: No device code or URL received', 'error');
        }
    } catch (error) {
        showAlert('Failed to start Copilot OAuth: ' + error.message, 'error');
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
            if (attempts < maxAttempts) {
                setTimeout(poll, 2000);
            }
        }
    };

    poll();
}

async function submitCopilotToken() {
    const token = document.getElementById('copilotToken').value.trim();
    const email = document.getElementById('copilotEmail')?.value.trim();

    if (!token) {
        showAlert('Please enter a token', 'error');
        return;
    }

    try {
        await API.submitCopilotToken(token, email || undefined);
        showAlert('Copilot token submitted successfully!', 'success');
        document.getElementById('copilotToken').value = '';
        if (document.getElementById('copilotEmail')) {
            document.getElementById('copilotEmail').value = '';
        }
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

async function submitOAuthCallback() {
    const provider = document.getElementById('callbackProvider').value;
    const redirectUrl = document.getElementById('callbackUrl').value.trim();

    if (!redirectUrl) {
        showAlert('Please enter the redirect URL', 'error');
        return;
    }

    try {
        await API.submitOAuthCallback(provider, redirectUrl);
        showAlert('OAuth callback submitted successfully!', 'success');
        document.getElementById('callbackUrl').value = '';
    } catch (error) {
        showAlert('Failed to submit callback: ' + error.message, 'error');
    }
}
