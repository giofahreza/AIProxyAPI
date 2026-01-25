// Utility Functions

// Show alert message
function showAlert(message, type = 'info') {
    const container = document.getElementById('pageContent');
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;

    container.insertBefore(alertDiv, container.firstChild);

    setTimeout(() => alertDiv.remove(), 5000);
}

// Format date - handles both Unix timestamps and ISO 8601 strings
function formatDate(timestamp) {
    if (!timestamp) return 'Unknown';

    let date;

    // Check if it's a string (ISO 8601 format like "2025-01-24T23:29:16Z")
    if (typeof timestamp === 'string') {
        date = new Date(timestamp);
    }
    // Check if it's a number (Unix timestamp in seconds or milliseconds)
    else if (typeof timestamp === 'number') {
        // If timestamp is less than a reasonable millisecond value, assume it's seconds
        if (timestamp < 10000000000) {
            date = new Date(timestamp * 1000);
        } else {
            date = new Date(timestamp);
        }
    }
    // Handle Date objects or other formats
    else {
        date = new Date(timestamp);
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
        return 'Unknown';
    }

    return date.toLocaleString();
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Show loading state
function showLoading(container) {
    container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading...</p></div>';
}

// Show error state
function showError(container, message) {
    container.innerHTML = `<div class="alert alert-error">${escapeHtml(message)}</div>`;
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Parse query string
function parseQuery(queryString) {
    const params = new URLSearchParams(queryString);
    const result = {};
    for (const [key, value] of params) {
        result[key] = value;
    }
    return result;
}

// Build query string
function buildQuery(params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== null && value !== undefined && value !== '') {
            searchParams.append(key, value);
        }
    }
    return searchParams.toString();
}

// Deep clone object
function cloneObject(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// Calculate success rate
function calculateSuccessRate(usage) {
    if (!usage || !usage.total_requests) return 0;
    const failed = usage.failed_requests || 0;
    const success = usage.total_requests - failed;
    return ((success / usage.total_requests) * 100).toFixed(1);
}

// Show modal
function showModal(title, content, onConfirm) {
    const modalHtml = `
        <div class="modal show" id="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">${escapeHtml(title)}</h3>
                    <button class="modal-close" onclick="closeModal()">&times;</button>
                </div>
                <div class="modal-body">${content}</div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="modalConfirm">Confirm</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    if (onConfirm) {
        document.getElementById('modalConfirm').onclick = () => {
            onConfirm();
            closeModal();
        };
    }
}

function closeModal() {
    const modal = document.getElementById('modal');
    if (modal) modal.remove();
}

// Download file
function downloadFile(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// Validate URL
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// Copy to clipboard
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showAlert('Copied to clipboard', 'success');
    } catch (err) {
        showAlert('Failed to copy', 'error');
    }
}
