// Logs Page

async function renderLogs(container) {
    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h2 class="card-title">Application Logs</h2>
                <div>
                    <button class="btn btn-secondary" onclick="refreshLogs()">Refresh</button>
                    <button class="btn" onclick="downloadLogs()">Download</button>
                    <button class="btn btn-danger" onclick="clearLogs()">Clear</button>
                </div>
            </div>
            <div class="card-body">
                <div id="logsContent" class="loading">Loading logs...</div>
            </div>
        </div>

        <div class="card mt-20">
            <div class="card-header">
                <h2 class="card-title">Error Logs</h2>
                <button class="btn btn-secondary" onclick="refreshErrorLogs()">Refresh</button>
            </div>
            <div class="card-body">
                <div id="errorLogsContent" class="loading">Loading error logs...</div>
            </div>
        </div>
    `;

    loadLogs();
    loadErrorLogs();
}

async function loadLogs() {
    const logsDiv = document.getElementById('logsContent');
    try {
        const logs = await API.getLogs();
        // Handle case where logging is disabled - API returns { error: "..." }
        if (logs && typeof logs === 'object' && logs.error) {
            logsDiv.innerHTML = '<div class="alert alert-info">' + escapeHtml(logs.error) + '</div>';
        } else if (logs && typeof logs === 'string' && logs.trim()) {
            logsDiv.innerHTML = '<pre style="max-height: 600px; overflow-y: auto;">' + escapeHtml(logs) + '</pre>';
        } else {
            logsDiv.innerHTML = '<p class="text-center">No logs available</p>';
        }
    } catch (error) {
        logsDiv.innerHTML = '<div class="alert alert-error">Failed to load logs: ' + escapeHtml(error.message) + '</div>';
    }
}

async function loadErrorLogs() {
    const errorLogsDiv = document.getElementById('errorLogsContent');
    try {
        const data = await API.getRequestErrorLogs();
        const files = data.files || [];

        if (files.length === 0) {
            errorLogsDiv.innerHTML = '<p class="text-center">No error logs</p>';
        } else {
            let html = '<table class="table"><thead><tr><th>Filename</th><th>Size</th><th>Modified</th><th width="150">Actions</th></tr></thead><tbody>';
            files.forEach(file => {
                html += '<tr>';
                html += '<td>' + escapeHtml(file.name) + '</td>';
                html += '<td>' + formatFileSize(file.size) + '</td>';
                html += '<td>' + formatDate(file.modified) + '</td>';
                html += '<td><button class="btn btn-sm" onclick="downloadErrorLog(\'' + escapeHtml(file.name) + '\')">Download</button></td>';
                html += '</tr>';
            });
            html += '</tbody></table>';
            errorLogsDiv.innerHTML = html;
        }
    } catch (error) {
        errorLogsDiv.innerHTML = '<div class="alert alert-error">Failed to load error logs: ' + escapeHtml(error.message) + '</div>';
    }
}

async function refreshLogs() {
    document.getElementById('logsContent').innerHTML = '<div class="loading">Loading logs...</div>';
    await loadLogs();
    showAlert('Logs refreshed', 'success');
}

async function refreshErrorLogs() {
    document.getElementById('errorLogsContent').innerHTML = '<div class="loading">Loading error logs...</div>';
    await loadErrorLogs();
    showAlert('Error logs refreshed', 'success');
}

async function downloadLogs() {
    try {
        const logs = await API.getLogs();
        // Handle case where logging is disabled
        if (logs && typeof logs === 'object' && logs.error) {
            showAlert(logs.error, 'warning');
            return;
        }
        if (!logs || (typeof logs === 'string' && !logs.trim())) {
            showAlert('No logs available to download', 'warning');
            return;
        }
        downloadFile(logs, 'logs.txt', 'text/plain');
        showAlert('Logs downloaded successfully!', 'success');
    } catch (error) {
        showAlert('Failed to download logs: ' + error.message, 'error');
    }
}

async function downloadErrorLog(filename) {
    try {
        const content = await API.downloadRequestErrorLog(filename);
        downloadFile(content, filename, 'text/plain');
        showAlert('Error log downloaded successfully!', 'success');
    } catch (error) {
        showAlert('Failed to download: ' + error.message, 'error');
    }
}

async function clearLogs() {
    if (!confirm('Are you sure you want to clear all logs? This action cannot be undone.')) return;

    try {
        await API.deleteLogs();
        showAlert('Logs cleared successfully!', 'success');
        await loadLogs();
    } catch (error) {
        showAlert('Failed to clear logs: ' + error.message, 'error');
    }
}
