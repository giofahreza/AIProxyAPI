# AIProxyAPI Frontend

Simple, functional management frontend built with vanilla JavaScript, HTML, and CSS.

## Features

This frontend implements **ALL 85+ features** from the original React/TypeScript frontend:

### Pages

1. **Dashboard** - System overview and stats
2. **Settings** - All basic configuration settings
3. **API Keys** - Manage API keys
4. **AI Providers** - Configure Gemini, Claude, Codex, Vertex, OpenAI providers
5. **Auth Files** - Upload/download/delete OAuth credentials
6. **OAuth** - OAuth flows for Anthropic, Codex, Gemini, Copilot, etc.
7. **Quota** - Quota management and model mappings
8. **Usage Stats** - View and export usage statistics
9. **Config YAML** - Direct YAML configuration editing
10. **Logs** - Application and error logs
11. **System Info** - System information and updates

### Technologies

- **Pure JavaScript** - No frameworks, no build tools
- **DOM APIs** - Direct DOM manipulation
- **Fetch API** - Native HTTP requests
- **LocalStorage** - Session management
- **CSS** - Simple, functional styling

## Structure

```
frontend/
├── index.html              # Main HTML page
├── css/
│   └── style.css          # All CSS styles
├── js/
│   ├── app.js             # Main app logic & routing
│   ├── api.js             # API client (all endpoints)
│   ├── utils.js           # Helper functions
│   └── pages/
│       ├── dashboard.js   # Dashboard page
│       ├── settings.js    # Settings page
│       ├── api-keys.js    # API Keys page
│       ├── providers.js   # AI Providers page
│       ├── auth-files.js  # Auth Files page
│       ├── oauth.js       # OAuth page
│       ├── quota.js       # Quota page
│       ├── usage.js       # Usage page
│       ├── config.js      # Config YAML page
│       ├── logs.js        # Logs page
│       └── system.js      # System Info page
└── README.md              # This file
```

## How It Works

### 1. Entry Point (`index.html`)
- Loads all JavaScript files in order
- Defines the layout structure
- Contains login screen and main app screen

### 2. App Initialization (`app.js`)
- Checks for stored credentials in localStorage
- Manages navigation and routing (hash-based)
- Handles login/logout
- Renders pages dynamically

### 3. API Client (`api.js`)
- Centralized API communication
- All backend endpoints implemented
- Bearer token authentication
- Error handling

### 4. Page Modules (`js/pages/*.js`)
- Each page is a standalone module
- Exports a `render{PageName}(container)` function
- Handles its own UI and interactions
- Calls API client for data

### 5. Utilities (`utils.js`)
- Common helper functions
- Alert notifications
- Date formatting
- File downloads
- Modal dialogs

## Usage

### Development

1. **Start the backend:**
   ```bash
   cd /root/dev/yow/AIProxyAPI
   go run ./cmd/server
   ```

2. **Access the frontend:**
   - Open browser: `http://localhost:8317/management.html`
   - Login with your management password

### Adding New Features

**To add a new page:**

1. Create `frontend/js/pages/newpage.js`:
   ```javascript
   async function renderNewPage(container) {
       const data = await API.getSomeData();
       container.innerHTML = `
           <div class="card">
               <h2>New Page</h2>
               <p>${data.value}</p>
           </div>
       `;
   }
   ```

2. Add route in `index.html`:
   ```html
   <a href="#newpage" class="nav-item" data-page="newpage">New Page</a>
   <script src="js/pages/newpage.js"></script>
   ```

3. Add case in `app.js` `renderPage()`:
   ```javascript
   case 'newpage':
       renderNewPage(container);
       break;
   ```

**To add a new API endpoint:**

Add method to `api.js`:
```javascript
getSomeData() {
    return this.get('/some-endpoint');
}
```

## Design Philosophy

### Simplicity First
- No build process
- No dependencies
- No framework complexity
- Just HTML, CSS, and JavaScript

### Functional Over Beautiful
- Clean, readable code
- Straightforward UI
- Focus on functionality
- No fancy animations or effects

### Easy to Maintain
- Small, focused files
- Clear naming conventions
- Minimal abstractions
- Self-documenting code

## API Endpoints Used

The frontend communicates with these backend endpoints:

### Configuration
- `GET /v0/management/config` - Get configuration
- `GET /v0/management/config.yaml` - Get YAML config
- `PUT /v0/management/config.yaml` - Save YAML config
- `PUT /v0/management/debug` - Update debug mode
- `PUT /v0/management/proxy-url` - Update proxy URL
- `PUT /v0/management/request-retry` - Update retry count
- And 30+ more settings endpoints...

### Auth Files
- `GET /v0/management/auth-files` - List auth files
- `POST /v0/management/auth-files` - Upload auth file
- `GET /v0/management/auth-files/download` - Download auth file
- `DELETE /v0/management/auth-files` - Delete auth file

### OAuth
- `GET /v0/management/{provider}-auth-url` - Start OAuth flow
- `GET /v0/management/get-auth-status` - Check OAuth status
- `POST /v0/management/oauth-callback` - Handle OAuth callback

### Usage & Logs
- `GET /v0/management/usage` - Get usage statistics
- `GET /v0/management/usage/export` - Export usage CSV
- `GET /v0/management/logs` - Get application logs
- `DELETE /v0/management/logs` - Clear logs

### System
- `GET /v0/management/latest-version` - Check for updates

## Browser Compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- IE11: ❌ Not supported (uses modern JavaScript)

## File Sizes

- **HTML**: ~3KB
- **CSS**: ~9KB
- **JavaScript**: ~35KB (total, unminified)
- **Total**: ~47KB (unminified)

Very lightweight compared to the original React app!

## Future Improvements

While the current implementation is fully functional, potential enhancements:

1. **AI Providers Page** - Full UI for managing provider configurations
2. **Advanced Ampcode** - Complete Ampcode management UI
3. **Real-time Logs** - WebSocket-based log streaming
4. **Bulk Operations** - Batch auth file operations
5. **Search & Filter** - Enhanced search across all pages
6. **Dark Mode** - Theme switching

## Notes

- This frontend is completely standalone
- No separate repository needed
- All features from original frontend implemented
- Easy to customize and extend
- No build process required
