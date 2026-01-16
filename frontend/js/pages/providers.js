// AI Providers Page

async function renderProviders(container) {
    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h2 class="card-title">AI Providers</h2>
            </div>
            <div class="card-body">
                <p class="alert alert-info">AI Providers management - Gemini, Claude, Codex, Vertex, OpenAI Compatible</p>
                <p>This page allows you to configure multiple AI provider API keys with custom settings.</p>
                <p><strong>Note:</strong> Full provider management UI will be implemented. For now, use the Config YAML page to edit providers directly.</p>
            </div>
        </div>
    `;
}
