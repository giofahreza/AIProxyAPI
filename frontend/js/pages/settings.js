// Settings Page

async function renderSettings(container) {
    try {
        const config = await API.getConfig();

        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Basic Settings</h2>
                </div>
                <div class="card-body">
                    <div id="settingsAlert"></div>

                    <div class="form-group">
                        <label class="toggle">
                            <input type="checkbox" id="debugMode" ${config.debug ? 'checked' : ''}>
                            <span>Debug Mode</span>
                        </label>
                        <small>Enable detailed debug logging</small>
                    </div>

                    <div class="form-group">
                        <label class="toggle">
                            <input type="checkbox" id="loggingToFile" ${config.logging_to_file ? 'checked' : ''}>
                            <span>Logging to File</span>
                        </label>
                        <small>Write application logs to rotating files</small>
                    </div>

                    <div class="form-group">
                        <label class="toggle">
                            <input type="checkbox" id="requestLog" ${config.request_log ? 'checked' : ''}>
                            <span>Request Logging</span>
                        </label>
                        <small>Log HTTP requests and responses</small>
                    </div>

                    <div class="form-group">
                        <label class="toggle">
                            <input type="checkbox" id="usageStats" ${config.usage_statistics_enabled ? 'checked' : ''}>
                            <span>Usage Statistics</span>
                        </label>
                        <small>Enable usage statistics tracking</small>
                    </div>

                    <div class="form-group">
                        <label class="toggle">
                            <input type="checkbox" id="wsAuth" ${config.ws_auth ? 'checked' : ''}>
                            <span>WebSocket Authentication</span>
                        </label>
                        <small>Require authentication for WebSocket connections</small>
                    </div>

                    <div class="form-group">
                        <label class="toggle">
                            <input type="checkbox" id="forceModelPrefix" ${config.force_model_prefix ? 'checked' : ''}>
                            <span>Force Model Prefix</span>
                        </label>
                        <small>Only use credentials with matching prefix</small>
                    </div>

                    <div class="form-group">
                        <label for="proxyUrl">Proxy URL</label>
                        <input type="text" id="proxyUrl" value="${escapeHtml(config.proxy_url || '')}"
                               placeholder="socks5://user:pass@host:port">
                        <small>HTTP/SOCKS5 proxy for outgoing requests</small>
                    </div>

                    <div class="form-group">
                        <label for="requestRetry">Request Retry Count</label>
                        <input type="number" id="requestRetry" value="${config.request_retry || 3}" min="0" max="10">
                        <small>Number of times to retry failed requests</small>
                    </div>

                    <div class="form-group">
                        <label for="maxRetryInterval">Max Retry Interval (seconds)</label>
                        <input type="number" id="maxRetryInterval" value="${config.max_retry_interval || 30}" min="0" max="300">
                        <small>Maximum wait time before retry</small>
                    </div>

                    <div class="form-group">
                        <label for="logsMaxSize">Logs Max Total Size (MB)</label>
                        <input type="number" id="logsMaxSize" value="${config.logs_max_total_size_mb || 0}" min="0">
                        <small>0 = unlimited. Old log files deleted when exceeded.</small>
                    </div>

                    <div class="form-group">
                        <label for="routingStrategy">Routing Strategy</label>
                        <select id="routingStrategy">
                            <option value="round-robin" ${config.routing?.strategy === 'round-robin' ? 'selected' : ''}>Round Robin</option>
                            <option value="fill-first" ${config.routing?.strategy === 'fill-first' ? 'selected' : ''}>Fill First</option>
                        </select>
                        <small>Strategy for selecting credentials when multiple match</small>
                    </div>

                    <button class="btn btn-success" onclick="saveSettings()">Save All Settings</button>
                </div>
            </div>
        `;

        // Setup event listeners for toggles (instant save)
        document.getElementById('debugMode').addEventListener('change', async (e) => {
            await updateSetting('debug', e.target.checked, API.updateDebug);
        });

        document.getElementById('loggingToFile').addEventListener('change', async (e) => {
            await updateSetting('loggingToFile', e.target.checked, API.updateLoggingToFile);
        });

        document.getElementById('requestLog').addEventListener('change', async (e) => {
            await updateSetting('requestLog', e.target.checked, API.updateRequestLog);
        });

        document.getElementById('usageStats').addEventListener('change', async (e) => {
            await updateSetting('usageStats', e.target.checked, API.updateUsageStats);
        });

        document.getElementById('wsAuth').addEventListener('change', async (e) => {
            await updateSetting('wsAuth', e.target.checked, API.updateWsAuth);
        });

        document.getElementById('forceModelPrefix').addEventListener('change', async (e) => {
            await updateSetting('forceModelPrefix', e.target.checked, API.updateForceModelPrefix);
        });

    } catch (error) {
        showError(container, 'Failed to load settings: ' + error.message);
    }
}

async function updateSetting(name, value, apiMethod) {
    const alertDiv = document.getElementById('settingsAlert');
    try {
        await apiMethod.call(API, value);
        alertDiv.innerHTML = '<div class="alert alert-success">Setting updated successfully</div>';
        setTimeout(() => alertDiv.innerHTML = '', 3000);
        await App.refreshConfig();
    } catch (error) {
        alertDiv.innerHTML = `<div class="alert alert-error">Failed to update: ${escapeHtml(error.message)}</div>`;
    }
}

async function saveSettings() {
    const alertDiv = document.getElementById('settingsAlert');
    try {
        const proxyUrl = document.getElementById('proxyUrl').value.trim();
        const requestRetry = parseInt(document.getElementById('requestRetry').value);
        const maxRetryInterval = parseInt(document.getElementById('maxRetryInterval').value);
        const logsMaxSize = parseInt(document.getElementById('logsMaxSize').value);
        const routingStrategy = document.getElementById('routingStrategy').value;

        await Promise.all([
            API.updateProxyUrl(proxyUrl),
            API.updateRequestRetry(requestRetry),
            API.updateMaxRetryInterval(maxRetryInterval),
            API.updateLogsMaxSize(logsMaxSize),
            API.updateRoutingStrategy(routingStrategy)
        ]);

        alertDiv.innerHTML = '<div class="alert alert-success">All settings saved successfully!</div>';
        await App.refreshConfig();
        setTimeout(() => alertDiv.innerHTML = '', 3000);
    } catch (error) {
        alertDiv.innerHTML = `<div class="alert alert-error">Failed to save: ${escapeHtml(error.message)}</div>`;
    }
}
