 ⎿  Read 100 lines

● Read(~/dev/yow/Ai-Proxy-API-Management-Cen
      ter/src/services/api/oauth.ts)
  ⎿  Read 90 lines

● Read(~/dev/yow/Ai-Proxy-API-Management-Cen
      ter/src/services/api/ampcode.ts)
  ⎿  Read 38 lines

● Based on exploring the original frontend, h

  Complete Feature List

  1. Login Page

  - Login with management password
  - Connection to API server

  2. Dashboard

  - System overview stats
  - Connection status
  - Server info (host, port, version)
  - Quick access to common tasks

  3. Basic Settings

  - Debug mode toggle
  - Proxy URL configuration
  - Request retry count
  - Max retry interval
  - Force model prefix toggle
  - Routing strategy (round-robin/fill-first)
  - WebSocket authentication toggle
  - Logging to file toggle
  - Logs max total size (MB)
  - Request log toggle
  - Usage statistics toggle

  4. API Keys

  - List API keys
  - Add new API keys
  - Remove API keys

  5. AI Providers

  Gemini API Keys:
  - Add/edit/delete Gemini keys
  - Configure: prefix, base URL, proxy URL, h

  Claude API Keys:
  - Add/edit/delete Claude keys
  - Configure: prefix, base URL, proxy URL, h

  Codex API Keys:
  - Add/edit/delete Codex keys
  - Configure: prefix, base URL, proxy URL, h

  Vertex AI Compatible:
  - Add/edit/delete Vertex keys
  - Configure: prefix, base URL, proxy URL, h

  OpenAI Compatibility:
  - Add/edit/delete OpenAI compatible provide
  - Configure: name, base URL, API keys with

  6. Auth Files

  - List all auth files (OAuth credentials)
  - Upload auth file (.json)
  - Download auth file
  - Delete auth file
  - View file details (provider, modified tim
  - Import Vertex credential

  7. OAuth

  Supported providers:
  - Anthropic (Claude)
  - Codex
  - Gemini CLI (with project ID)
  - Antigravity
  - Qwen
  - GitHub Copilot (device flow + token submi
  - iFlow (cookie authentication)

  Features:
  - Start OAuth flow
  - Handle OAuth callbacks
  - Poll authentication status
  - Submit tokens/cookies manually

  8. Quota Management

  - Switch project on quota exceeded toggle
  - Switch preview model on quota exceeded to
  - OAuth excluded models (list with wildcard
  - OAuth model mappings (upstream → local)

  9. Usage Statistics

  - View total requests
  - View success rate
  - View detailed statistics by model/provide
  - Export usage data (CSV format)
  - Import usage data

  10. Configuration (YAML)

  - View full config.yaml
  - Edit config.yaml directly
  - Save changes to file

  11. Logs

  - View real-time application logs
  - Search/filter logs
  - Hide management logs
  - Auto-refresh logs
  - Download logs
  - Clear logs
  - View error logs (list files)
  - Download error log files
  - View request logs by ID

  12. System Info

  - Connection status
  - Server version & build date
  - Check for updates
  - Available models list (grouped by provide
  - Quick links to documentation/repos
  - Clear login data

  13. Ampcode (Amp CLI Integration)

  - Configure upstream URL
  - Configure upstream API key
  - Model mappings management (add/edit/delete)
  - Force model mappings toggle
  - Restrict management to localhost
  - Multiple upstream API keys

  ---
  Total: ~85+ distinct features across 13 pages
