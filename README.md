# AI Proxy API

> **Note:** This project is a fork of [router-for-me/CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI).

## What is AIProxyAPI?

**AIProxyAPI** is a unified API gateway that lets you access multiple AI providers (Claude, Gemini, OpenAI Codex, and more) through a single, OpenAI-compatible interface. Think of it as a "reverse proxy for AI APIs" that handles authentication, load balancing, and protocol translation automatically.

## Why Use AIProxyAPI?

### 🎯 **One API for All Providers**
Write your code once using OpenAI's API format, then switch between Claude, Gemini, or other providers by just changing the model name. No code changes needed.

### 🔄 **Automatic Load Balancing**
Add multiple API keys or OAuth accounts, and AIProxyAPI automatically rotates between them. When one hits rate limits, it switches to the next available credential.

### 🔐 **Centralized Authentication**
Manage all your AI provider credentials in one place. Your applications never see the actual API keys - they just authenticate to the proxy.

### 📊 **Usage Tracking**
Built-in usage statistics track token consumption across all providers, models, and API keys. See exactly where your AI costs are going.

### 🌐 **Multi-Provider Support**
- **Gemini**: Google's Gemini models (AI Studio, Vertex AI, CLI)
- **Claude**: Anthropic's Claude models (API keys and OAuth)
- **OpenAI Codex**: GPT models via OAuth
- **Qwen**: Alibaba's Qwen Code models
- **GitHub Copilot**: Copilot models integration
- **iFlow**: Flow-based AI models
- **Custom Providers**: Any OpenAI-compatible API endpoint

## Key Features

### 🚀 **Easy Setup**
```bash
# Start the server
./aiproxyapi --config config.yaml

# Use with any OpenAI client
curl http://localhost:8317/v1/chat/completions \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### 🔧 **Advanced Features**
- **Protocol Translation**: OpenAI ↔ Gemini ↔ Claude format conversion
- **Model Aliasing**: Map model names (e.g., `gpt-latest` → `claude-sonnet-4`)
- **Quota Management**: Automatic failover when quotas are exceeded
- **Hot Reload**: Update config without restarting the server
- **Web Control Panel**: Manage credentials and view usage via browser
- **Multiple Storage Backends**: File-based, PostgreSQL, Git, or S3-compatible storage

### 📡 **API Compatibility**
Supports multiple API formats:
- OpenAI Chat Completions API (`/v1/chat/completions`)
- OpenAI Responses API (`/v1/responses`)
- Gemini GenerateContent API (`/v1/models/:model:generateContent`)
- Claude Messages API (`/v1/messages`)
- WebSocket support for real-time streaming

### 🎨 **OAuth Integration**
Seamless OAuth flows for:
- Claude (Anthropic Console)
- OpenAI Codex (GitHub)
- Gemini CLI (Google Cloud)
- Qwen Code
- GitHub Copilot
- iFlow

## Common Use Cases

### 1️⃣ **Multi-Provider Applications**
Build an AI app that works with multiple providers without vendor lock-in:
```javascript
// Same code works with Claude, Gemini, or any provider
const response = await openai.chat.completions.create({
  model: "claude-sonnet-4",  // or "gemini-2-flash" or "gpt-4o"
  messages: [{ role: "user", content: "Hello" }]
});
```

### 2️⃣ **Team Credential Management**
Give your team access to AI models without sharing raw API keys:
- Configure credentials once in AIProxyAPI
- Team members use a shared proxy URL
- Track usage per team member
- Rotate credentials without updating applications

### 3️⃣ **Development & Testing**
Test different AI models without changing your code:
```bash
# Test with Claude
curl ... -d '{"model": "claude-sonnet-4", ...}'

# Test with Gemini
curl ... -d '{"model": "gemini-2-flash", ...}'

# Test with Codex
curl ... -d '{"model": "gpt-5-codex", ...}'
```

### 4️⃣ **Cost Optimization**
- Monitor token usage across all models
- Set up quota limits per API key
- Automatically switch to cheaper models on failures
- Track spending by team, project, or user

### 5️⃣ **Enterprise Deployment**
- Deploy behind your firewall
- Use PostgreSQL for shared credential storage
- Multiple server instances with load balancing
- Integrate with existing auth systems

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/giofahreza/AIProxyAPI.git
cd AIProxyAPI

# Build the binary
go build -o aiproxyapi cmd/server/main.go

# Create config file
cp config.example.yaml config.yaml
```

### Configuration

Edit `config.yaml`:

```yaml
# Server settings
port: 8317
auth-dir: "~/.cli-proxy-api"

# Your API keys
api-keys:
  - "your-secret-key"

# Enable usage tracking
usage-statistics-enabled: true

# Add provider credentials (optional)
gemini-api-key:
  - api-key: "your-gemini-key"

claude-api-key:
  - api-key: "your-claude-key"
```

### OAuth Authentication (Optional)

For OAuth providers like Claude or Codex:

```bash
# Authenticate with Claude
./aiproxyapi --config config.yaml --claude-login

# Authenticate with Codex
./aiproxyapi --config config.yaml --codex-login

# Authenticate with Gemini CLI
./aiproxyapi --config config.yaml --login
```

### Running the Server

```bash
# Start the server
./aiproxyapi --config config.yaml

# Server starts on http://localhost:8317
```

## Management

### Web Control Panel

Access the management UI at `http://localhost:8317/` to:
- View available models from all providers
- Manage OAuth credentials
- Monitor usage statistics
- Update configuration

### Management API

```bash
# List available models
curl http://localhost:8317/v0/management/models \
  -H "Authorization: Bearer your-management-key"

# View usage statistics
curl http://localhost:8317/v0/management/usage \
  -H "Authorization: Bearer your-management-key"

# List authentication entries
curl http://localhost:8317/v0/management/auths \
  -H "Authorization: Bearer your-management-key"
```

## Architecture

```
┌─────────────┐
│   Client    │
│ Application │
└──────┬──────┘
       │ OpenAI API Format
       ▼
┌─────────────────────────────────┐
│        AIProxyAPI               │
│  ┌──────────────────────────┐  │
│  │   API Key Validation     │  │
│  └────────────┬─────────────┘  │
│               ▼                 │
│  ┌──────────────────────────┐  │
│  │  Protocol Translation    │  │
│  │  (OpenAI ↔ Gemini ↔ Claude) │
│  └────────────┬─────────────┘  │
│               ▼                 │
│  ┌──────────────────────────┐  │
│  │  Credential Selection    │  │
│  │  (Load Balancing)        │  │
│  └────────────┬─────────────┘  │
└───────────────┼─────────────────┘
                │
    ┌───────────┼───────────┐
    ▼           ▼           ▼
┌────────┐  ┌────────┐  ┌────────┐
│ Claude │  │ Gemini │  │ Codex  │
│   API  │  │  API   │  │  API   │
└────────┘  └────────┘  └────────┘
```

## Advanced Configuration

### Model Aliasing

```yaml
oauth-model-mappings:
  gemini:
    - name: "gemini-2.0-flash-exp"
      alias: "gemini-flash-latest"
  claude:
    - name: "claude-sonnet-4-20250514"
      alias: "claude-sonnet-4"
```

### Load Balancing Strategy

```yaml
routing:
  strategy: "round-robin"  # Distribute evenly
  # OR
  strategy: "fill-first"   # Exhaust one credential first
```

### Quota Management

```yaml
quota-exceeded:
  switch-project: true        # Auto-switch to another account
  switch-preview-model: true  # Fall back to preview models

request-retry: 3              # Retry failed requests
max-retry-interval: 30        # Max wait time before retry (seconds)
```

### Model Prefixing (Team Isolation)

```yaml
gemini-api-key:
  - api-key: "team-a-key"
    prefix: "teamA"
  - api-key: "team-b-key"
    prefix: "teamB"

# Teams use: "teamA/gemini-2-flash" and "teamB/gemini-2-flash"
```

## Storage Backends

### File-Based (Default)
```yaml
auth-dir: "~/.cli-proxy-api"
```

### PostgreSQL
```bash
export PGSTORE_DSN="postgres://user:pass@localhost/aiproxy"
./aiproxyapi --config config.yaml
```

### Git Repository
```bash
export GITSTORE_REMOTE_URL="https://github.com/org/auth-repo"
export GITSTORE_USER="username"
export GITSTORE_PASSWORD="token"
./aiproxyapi --config config.yaml
```

### S3-Compatible (MinIO, etc.)
```bash
export OBJSTORE_ENDPOINT="https://minio.example.com"
export OBJSTORE_ACCESS_KEY="access-key"
export OBJSTORE_SECRET_KEY="secret-key"
export OBJSTORE_BUCKET="aiproxy-auth"
./aiproxyapi --config config.yaml
```

## Usage Statistics

AIProxyAPI tracks usage automatically and stores statistics in `~/.cli-proxy-api/usage-statistics.json`:

```json
{
  "total_requests": 1234,
  "success_count": 1200,
  "failure_count": 34,
  "total_tokens": 450000,
  "apis": {
    "api-key-id": {
      "models": {
        "claude-sonnet-4": {
          "total_requests": 500,
          "total_tokens": 200000
        }
      }
    }
  }
}
```

Access statistics via Management API:
```bash
curl http://localhost:8317/v0/management/usage \
  -H "Authorization: Bearer your-management-key"
```

## Security

- API keys are never logged or exposed
- OAuth tokens stored securely with file permissions `600`
- Management API protected with bcrypt-hashed secret keys
- Optional localhost-only mode for management endpoints
- Support for TLS/HTTPS

## Production Deployment

### Systemd Service

```bash
# Create service file
sudo nano /etc/systemd/system/aiproxyapi.service
```

```ini
[Unit]
Description=AIProxyAPI Service
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/AIProxyAPI
ExecStart=/home/ubuntu/AIProxyAPI/aiproxyapi -config /home/ubuntu/AIProxyAPI/config.yaml
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start
sudo systemctl enable aiproxyapi
sudo systemctl start aiproxyapi
```

### Docker (Coming Soon)

```bash
docker run -d \
  -p 8317:8317 \
  -v $(pwd)/config.yaml:/config.yaml \
  -v ~/.cli-proxy-api:/auth \
  aiproxyapi:latest
```

## Troubleshooting

### Check Logs
```bash
# If using systemd
sudo journalctl -u aiproxyapi -f

# Or check log files
tail -f logs/aiproxyapi.log
```

### Test Connectivity
```bash
# List models
curl http://localhost:8317/v1/models

# Test completion
curl http://localhost:8317/v1/chat/completions \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"model": "claude-sonnet-4", "messages": [{"role": "user", "content": "test"}]}'
```

### Common Issues

1. **"No providers available"**: Add API keys or complete OAuth login
2. **"Invalid API key"**: Check `api-keys` in config.yaml
3. **"Model not found"**: Check available models at `/v1/models`
4. **OAuth redirect issues**: Ensure correct callback URLs in provider settings

## Documentation

- **Management API**: See [MANAGEMENT_API.md](https://help.router-for.me/management/api)
- **Full Guides**: [https://help.router-for.me/](https://help.router-for.me/)
- **SDK Usage**: See `docs/sdk-usage.md` for embedding the proxy in your Go applications

## Contributing

This project is a fork of [router-for-me/CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI).

## License

MIT License - see [LICENSE](LICENSE) file for details.

**Copyright:**
- 2025-2025.9: Luis Pater
- 2025.9-present: Router-For.ME

## Support

For issues, questions, or feature requests, please open an issue on GitHub.

