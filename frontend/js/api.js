// API Client for backend communication

const API = {
    baseUrl: '',
    token: '',

    // Initialize API with base URL and token
    init(baseUrl, token) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.token = token;
        localStorage.setItem('apiBase', this.baseUrl);
        localStorage.setItem('token', this.token);
    },

    // Generic request method
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}/v0/management${endpoint}`;
        const headers = {
            'Authorization': `Bearer ${this.token}`,
            ...options.headers
        };

        if (options.body && !(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(options.body);
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            if (response.status === 401) {
                // Unauthorized - logout
                window.location.reload();
                throw new Error('Unauthorized');
            }

            if (!response.ok) {
                const text = await response.text();
                throw new Error(text || `HTTP ${response.status}`);
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            return await response.text();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    // GET request
    get(endpoint, params) {
        const query = params ? '?' + buildQuery(params) : '';
        return this.request(endpoint + query, { method: 'GET' });
    },

    // POST request
    post(endpoint, body) {
        return this.request(endpoint, { method: 'POST', body });
    },

    // PUT request
    put(endpoint, body) {
        return this.request(endpoint, { method: 'PUT', body });
    },

    // PATCH request
    patch(endpoint, body) {
        return this.request(endpoint, { method: 'PATCH', body });
    },

    // DELETE request
    delete(endpoint, body) {
        return this.request(endpoint, { method: 'DELETE', body });
    },

    // === Configuration APIs ===
    getConfig() {
        return this.get('/config');
    },

    getConfigYAML() {
        return this.get('/config.yaml');
    },

    saveConfigYAML(yaml) {
        return this.put('/config.yaml', yaml);
    },

    updateDebug(enabled) {
        return this.put('/debug', { enabled });
    },

    updateLoggingToFile(enabled) {
        return this.put('/logging-to-file', { enabled });
    },

    updateUsageStats(enabled) {
        return this.put('/usage-statistics-enabled', { enabled });
    },

    updateRequestLog(enabled) {
        return this.put('/request-log', { enabled });
    },

    updateProxyUrl(url) {
        return url ? this.put('/proxy-url', { proxy_url: url }) : this.delete('/proxy-url');
    },

    updateRequestRetry(count) {
        return this.put('/request-retry', { value: count });
    },

    updateMaxRetryInterval(seconds) {
        return this.put('/max-retry-interval', { value: seconds });
    },

    updateForceModelPrefix(enabled) {
        return this.put('/force-model-prefix', { value: enabled });
    },

    updateRoutingStrategy(strategy) {
        return this.put('/routing/strategy', { value: strategy });
    },

    updateWsAuth(enabled) {
        return this.put('/ws-auth', { value: enabled });
    },

    updateLogsMaxSize(mb) {
        return this.put('/logs-max-total-size-mb', { value: mb });
    },

    // === API Keys ===
    getAPIKeys() {
        return this.get('/api-keys');
    },

    addAPIKey(key) {
        return this.patch('/api-keys', { old: "", new: key });
    },

    deleteAPIKey(key) {
        return this.delete('/api-keys?' + buildQuery({ value: key }));
    },

    // === AI Providers ===
    // API returns {"gemini-api-key": [...]} - extract the array
    async getGeminiKeys() {
        const data = await this.get('/gemini-api-key');
        return data?.['gemini-api-key'] || data?.geminiApiKey || [];
    },

    addGeminiKey(config) {
        return this.put('/gemini-api-key', { value: [config] });
    },

    updateGeminiKey(config) {
        return this.patch('/gemini-api-key', { value: [config] });
    },

    deleteGeminiKey(apiKey) {
        return this.delete('/gemini-api-key', { value: [apiKey] });
    },

    // API returns {"claude-api-key": [...]} - extract the array
    async getClaudeKeys() {
        const data = await this.get('/claude-api-key');
        return data?.['claude-api-key'] || data?.claudeApiKey || [];
    },

    addClaudeKey(config) {
        return this.put('/claude-api-key', { value: [config] });
    },

    updateClaudeKey(config) {
        return this.patch('/claude-api-key', { value: [config] });
    },

    deleteClaudeKey(apiKey) {
        return this.delete('/claude-api-key', { value: [apiKey] });
    },

    // API returns {"codex-api-key": [...]} - extract the array
    async getCodexKeys() {
        const data = await this.get('/codex-api-key');
        return data?.['codex-api-key'] || data?.codexApiKey || [];
    },

    addCodexKey(config) {
        return this.put('/codex-api-key', { value: [config] });
    },

    updateCodexKey(config) {
        return this.patch('/codex-api-key', { value: [config] });
    },

    deleteCodexKey(apiKey) {
        return this.delete('/codex-api-key', { value: [apiKey] });
    },

    // API returns {"vertex-api-key": [...]} - extract the array
    async getVertexKeys() {
        const data = await this.get('/vertex-api-key');
        return data?.['vertex-api-key'] || data?.vertexApiKey || [];
    },

    addVertexKey(config) {
        return this.put('/vertex-api-key', { value: [config] });
    },

    updateVertexKey(config) {
        return this.patch('/vertex-api-key', { value: [config] });
    },

    deleteVertexKey(apiKey) {
        return this.delete('/vertex-api-key', { value: [apiKey] });
    },

    // API returns {"openai-compatibility": [...]} - extract the array
    async getOpenAICompat() {
        const data = await this.get('/openai-compatibility');
        return data?.['openai-compatibility'] || data?.openaiCompatibility || [];
    },

    addOpenAICompat(config) {
        return this.put('/openai-compatibility', { value: [config] });
    },

    updateOpenAICompat(config) {
        return this.patch('/openai-compatibility', { value: [config] });
    },

    deleteOpenAICompat(name) {
        return this.delete('/openai-compatibility', { value: [name] });
    },

    // === Auth Files ===
    listAuthFiles() {
        return this.get('/auth-files');
    },

    uploadAuthFile(file) {
        const formData = new FormData();
        formData.append('file', file);
        return this.post('/auth-files', formData);
    },

    downloadAuthFile(name) {
        return this.get('/auth-files/download', { name });
    },

    deleteAuthFile(name) {
        return this.delete('/auth-files', { name });
    },

    getAuthFileModels(name) {
        return this.get('/auth-files/models', { name });
    },

    importVertexCredential(content) {
        return this.post('/vertex/import', { content });
    },

    // === OAuth ===
    requestAnthropicAuth() {
        return this.get('/anthropic-auth-url', { is_webui: true });
    },

    requestCodexAuth() {
        return this.get('/codex-auth-url', { is_webui: true });
    },

    requestGeminiAuth(projectId) {
        return this.get('/gemini-cli-auth-url', { is_webui: true, project_id: projectId });
    },

    requestAntigravityAuth() {
        return this.get('/antigravity-auth-url', { is_webui: true });
    },

    requestQwenAuth() {
        return this.get('/qwen-auth-url');
    },

    requestCopilotAuth() {
        return this.get('/copilot-auth-url', { is_webui: true });
    },

    getCopilotTokenStatus(deviceCode) {
        return this.get('/copilot-token-status', { device_code: deviceCode });
    },

    submitCopilotToken(githubToken, email) {
        return this.post('/copilot-token', { github_token: githubToken, email });
    },

    requestIFlowAuth() {
        return this.get('/iflow-auth-url');
    },

    submitIFlowCookie(cookie) {
        return this.post('/iflow-auth-url', { cookie });
    },

    getAuthStatus(state) {
        return this.get('/get-auth-status', { state });
    },

    submitOAuthCallback(provider, redirectUrl) {
        return this.post('/oauth-callback', { provider, redirect_url: redirectUrl });
    },

    // === Quota ===
    updateSwitchProject(enabled) {
        return this.put('/quota-exceeded/switch-project', { value: enabled });
    },

    updateSwitchPreviewModel(enabled) {
        return this.put('/quota-exceeded/switch-preview-model', { value: enabled });
    },

    getOAuthExcludedModels() {
        return this.get('/oauth-excluded-models');
    },

    updateOAuthExcludedModels(models) {
        return this.put('/oauth-excluded-models', { value: models });
    },

    patchOAuthExcludedModels(models) {
        return this.patch('/oauth-excluded-models', { value: models });
    },

    deleteOAuthExcludedModels(models) {
        return this.delete('/oauth-excluded-models', { value: models });
    },

    getOAuthModelMappings() {
        return this.get('/oauth-model-mappings');
    },

    updateOAuthModelMappings(mappings) {
        return this.put('/oauth-model-mappings', { value: mappings });
    },

    patchOAuthModelMappings(mappings) {
        return this.patch('/oauth-model-mappings', { value: mappings });
    },

    deleteOAuthModelMappings(fromModels) {
        return this.delete('/oauth-model-mappings', { value: fromModels });
    },

    // === Usage ===
    getUsage() {
        return this.get('/usage');
    },

    exportUsage() {
        return this.get('/usage/export');
    },

    importUsage(file) {
        const formData = new FormData();
        formData.append('file', file);
        return this.post('/usage/import', formData);
    },

    // === Logs ===
    getLogs() {
        return this.get('/logs');
    },

    deleteLogs() {
        return this.delete('/logs');
    },

    getRequestLog() {
        return this.get('/request-log');
    },

    getRequestErrorLogs() {
        return this.get('/request-error-logs');
    },

    downloadRequestErrorLog(name) {
        return this.get(`/request-error-logs/${name}`);
    },

    getRequestLogById(id) {
        return this.get(`/request-log-by-id/${id}`);
    },

    // === System ===
    getLatestVersion() {
        return this.get('/latest-version');
    },

    async getServerVersion() {
        // Server version is returned in X-CPA-VERSION header
        const url = `${this.baseUrl}/v0/management/config`;
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        return {
            version: response.headers.get('X-CPA-VERSION') || 'unknown',
            status: response.status
        };
    },

    async getAvailableModels() {
        // Fetch models from the /v1/models endpoint
        const url = `${this.baseUrl}/v1/models`;
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();
            return data.data || data.models || [];
        } catch (error) {
            console.error('Failed to fetch models:', error);
            return [];
        }
    },

    // === Ampcode ===
    getAmpcode() {
        return this.get('/ampcode');
    },

    updateAmpUpstreamUrl(url) {
        return url ? this.put('/ampcode/upstream-url', { value: url }) : this.delete('/ampcode/upstream-url');
    },

    updateAmpUpstreamApiKey(key) {
        return key ? this.put('/ampcode/upstream-api-key', { value: key }) : this.delete('/ampcode/upstream-api-key');
    },

    getAmpModelMappings() {
        return this.get('/ampcode/model-mappings');
    },

    updateAmpModelMappings(mappings) {
        return this.put('/ampcode/model-mappings', { value: mappings });
    },

    patchAmpModelMappings(mappings) {
        return this.patch('/ampcode/model-mappings', { value: mappings });
    },

    deleteAmpModelMappings(fromList) {
        return this.delete('/ampcode/model-mappings', { value: fromList });
    },

    updateAmpForceModelMappings(enabled) {
        return this.put('/ampcode/force-model-mappings', { value: enabled });
    },

    updateAmpRestrictToLocalhost(enabled) {
        return this.put('/ampcode/restrict-management-to-localhost', { value: enabled });
    },

    getAmpUpstreamApiKeys() {
        return this.get('/ampcode/upstream-api-keys');
    },

    updateAmpUpstreamApiKeys(keys) {
        return this.put('/ampcode/upstream-api-keys', { value: keys });
    },

    patchAmpUpstreamApiKeys(keys) {
        return this.patch('/ampcode/upstream-api-keys', { value: keys });
    },

    deleteAmpUpstreamApiKeys(keys) {
        return this.delete('/ampcode/upstream-api-keys', { value: keys });
    }
};
