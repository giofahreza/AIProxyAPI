// Auth Files Page

async function renderAuthFiles(container) {
    try {
        const files = await API.listAuthFiles();

        container.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">Authentication Files</h2>
                </div>
                <div class="card-body">
                    <div id="authFilesAlert"></div>

                    <h3>Upload New Auth File</h3>
                    <div class="flex flex-gap mb-20">
                        <input type="file" id="authFileInput" accept=".json">
                        <button class="btn" onclick="uploadAuthFile()">Upload</button>
                    </div>

                    <h3>Existing Auth Files</h3>
                    ${files.length === 0 ? '<p class="text-center">No auth files found</p>' : `
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Filename</th>
                                    <th>Provider</th>
                                    <th>Modified</th>
                                    <th width="200">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${files.map(file => `
                                    <tr>
                                        <td><strong>${escapeHtml(file.name)}</strong></td>
                                        <td>${escapeHtml(file.provider || 'Unknown')}</td>
                                        <td>${formatDate(file.modified_time)}</td>
                                        <td>
                                            <button class="btn btn-sm" onclick="downloadAuthFile('${escapeHtml(file.name)}')">Download</button>
                                            <button class="btn btn-danger btn-sm" onclick="deleteAuthFile('${escapeHtml(file.name)}')">Delete</button>
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
        showError(container, 'Failed to load auth files: ' + error.message);
    }
}

async function uploadAuthFile() {
    const input = document.getElementById('authFileInput');
    if (!input.files || !input.files[0]) {
        showAlert('Please select a file', 'error');
        return;
    }

    try {
        await API.uploadAuthFile(input.files[0]);
        showAlert('Auth file uploaded successfully!', 'success');
        input.value = '';
        renderAuthFiles(document.getElementById('pageContent'));
    } catch (error) {
        showAlert('Failed to upload: ' + error.message, 'error');
    }
}

async function downloadAuthFile(filename) {
    try {
        const content = await API.downloadAuthFile(filename);
        downloadFile(JSON.stringify(content, null, 2), filename, 'application/json');
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
