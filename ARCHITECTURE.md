# AIProxyAPI - Complete Architecture Documentation

## 📋 Overview

**AIProxyAPI** is a unified AI gateway proxy that provides a single OpenAI-compatible interface to multiple AI providers (Anthropic Claude, Google Gemini, OpenAI Codex, Qwen, GitHub Copilot, iFlow, etc.).

---

## 🏗️ Architecture Diagrams

### 1. Overall System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        CLI[CLI Tools]
        WebUI[Web Browser]
        SDK[SDK/Libraries]
    end

    subgraph "API Gateway (AIProxyAPI)"
        Router[Gin HTTP Router]

        subgraph "Middleware Chain"
            MW1[Logger]
            MW2[Recovery]
            MW3[Request Logging]
            MW4[CORS]
            MW5[Auth Middleware]
            MW6[Limits Middleware]
        end

        subgraph "Core Components"
            AccessMgr[Access Manager<br/>API Key Validation]
            AuthMgr[Auth Manager<br/>Credential Selection]
            Registry[Model Registry<br/>Reference Counting]
            Limits[Limits Enforcer<br/>Quotas & Restrictions]

            subgraph "Handlers"
                OpenAIH[OpenAI Handler]
                ClaudeH[Claude Handler]
                GeminiH[Gemini Handler]
            end

            subgraph "Translators"
                T1[OpenAI ↔ Gemini]
                T2[OpenAI ↔ Claude]
                T3[OpenAI ↔ Codex]
            end

            subgraph "Provider Executors"
                E1[Gemini Executor]
                E2[Claude Executor]
                E3[Codex Executor]
                E4[Vertex Executor]
                E5[Custom Executor]
            end
        end

        subgraph "Storage Layer"
            FileStore[File Storage]
            PostgresStore[PostgreSQL Store]
            GitStore[Git Store]
            S3Store[S3/MinIO Store]
        end

        Management[Management API<br/>Web Control Panel]
    end

    subgraph "External Services"
        subgraph "AI Providers"
            Anthropic[Anthropic API<br/>Claude]
            Google[Google AI Studio<br/>Gemini]
            VertexAI[Vertex AI<br/>Gemini]
            GitHub[GitHub Copilot<br/>Codex]
            Qwen[Qwen API]
            iFlow[iFlow API]
        end

        subgraph "OAuth Providers"
            AnthropicOAuth[Anthropic OAuth]
            GoogleOAuth[Google OAuth]
            GitHubOAuth[GitHub OAuth]
        end
    end

    CLI --> Router
    WebUI --> Router
    SDK --> Router

    Router --> MW1 --> MW2 --> MW3 --> MW4 --> MW5 --> MW6

    MW5 --> AccessMgr
    MW6 --> Limits

    MW6 --> OpenAIH
    MW6 --> ClaudeH
    MW6 --> GeminiH

    OpenAIH --> AuthMgr
    ClaudeH --> AuthMgr
    GeminiH --> AuthMgr

    AuthMgr --> Registry
    AuthMgr --> T1 & T2 & T3

    T1 --> E1
    T2 --> E2
    T3 --> E3
    T1 --> E4

    E1 --> Google
    E1 --> VertexAI
    E2 --> Anthropic
    E3 --> GitHub
    E4 --> VertexAI
    E5 --> Qwen & iFlow

    AuthMgr --> FileStore & PostgresStore & GitStore & S3Store

    Management --> AnthropicOAuth & GoogleOAuth & GitHubOAuth

    style Router fill:#4A90E2
    style AccessMgr fill:#F39C12
    style AuthMgr fill:#E74C3C
    style Registry fill:#9B59B6
    style Limits fill:#E67E22
```

### 2. Request Flow (Client → Response)

```mermaid
sequenceDiagram
    participant Client
    participant Router as Gin Router
    participant Auth as Auth Middleware
    participant Limits as Limits Middleware
    participant Handler as OpenAI Handler
    participant AuthMgr as Auth Manager
    participant Selector as Credential Selector
    participant Translator
    participant Executor as Provider Executor
    participant Provider as AI Provider (Claude/Gemini/etc)

    Client->>Router: POST /v1/chat/completions<br/>{model: "claude-sonnet-4", messages: [...]}

    Note over Router: Middleware Chain
    Router->>Router: 1. Logger
    Router->>Router: 2. Recovery
    Router->>Router: 3. Request Logging
    Router->>Router: 4. CORS

    Router->>Auth: 5. Auth Middleware
    Auth->>Auth: Extract API key from<br/>Authorization header
    Auth->>Auth: Validate via Access Manager
    Auth-->>Router: ✓ Set apiKey in context

    Router->>Limits: 6. Limits Middleware
    Limits->>Limits: Extract model from body
    Limits->>Limits: Check allowed-models pattern
    Limits->>Limits: Check monthly quota
    Limits->>Limits: Set allowedCredentials/Providers
    Limits-->>Router: ✓ Access granted

    Router->>Handler: Route to handler
    Handler->>Handler: Parse request body
    Handler->>Handler: Extract model name

    Handler->>AuthMgr: ExecuteWithAuthManager(model, request)

    AuthMgr->>AuthMgr: Determine providers from model<br/>(e.g., "claude-sonnet-4" → "claude")

    AuthMgr->>Selector: Pick credential for provider
    Selector->>Selector: Filter by allowedCredentials
    Selector->>Selector: Filter by provider type
    Selector->>Selector: RoundRobin or FillFirst selection
    Selector-->>AuthMgr: Return Auth (credential)

    AuthMgr->>Translator: Translate OpenAI → Provider format
    Translator-->>AuthMgr: Translated request

    AuthMgr->>Executor: Execute(auth, translatedRequest)

    Executor->>Executor: Add provider auth headers
    Executor->>Executor: Apply retry logic (3 attempts)

    Executor->>Provider: HTTP POST to provider API
    Provider-->>Executor: Provider response

    Executor->>Executor: Check for quota errors
    Executor->>Executor: Update cooldown if needed
    Executor-->>AuthMgr: Raw provider response

    AuthMgr->>Translator: Translate Provider → OpenAI format
    Translator->>Translator: Convert response structure
    Translator->>Translator: Extract usage tokens
    Translator-->>AuthMgr: OpenAI-formatted response

    AuthMgr-->>Handler: Final response
    Handler->>Handler: Record usage statistics
    Handler->>Handler: Update model registry
    Handler-->>Client: HTTP 200<br/>{id: "...", choices: [...], usage: {...}}
```

### 3. Authentication & Authorization Flow

```mermaid
flowchart TB
    Start[Client Request] --> ExtractKey[Extract API Key<br/>from Authorization header]

    ExtractKey --> ValidateKey{Valid API Key?}
    ValidateKey -->|No| Return401[Return 401 Unauthorized]
    ValidateKey -->|Yes| SetContext[Set apiKey in context]

    SetContext --> ExtractModel[Extract model from<br/>request body]
    ExtractModel --> CheckLimits{Check Limits}

    CheckLimits --> AllowedModels{Allowed Models<br/>Pattern Match?}
    AllowedModels -->|No| Return403A[Return 403 Forbidden<br/>Model not allowed]
    AllowedModels -->|Yes| CheckQuota

    CheckQuota{Monthly Quota<br/>Exceeded?}
    CheckQuota -->|Yes| Return403B[Return 403 Forbidden<br/>Quota exceeded]
    CheckQuota -->|No| SetRestrictions

    SetRestrictions[Set allowedCredentials<br/>and allowedProviders in context]

    SetRestrictions --> RouteHandler[Route to Handler]
    RouteHandler --> AuthManager[Auth Manager.Execute]

    AuthManager --> DetermineProvider[Determine provider<br/>from model name]
    DetermineProvider --> FilterCreds{Filter Credentials}

    FilterCreds --> FilterByAllowed[Filter by<br/>allowedCredentials from context]
    FilterByAllowed --> FilterByProvider[Filter by<br/>provider type match]
    FilterByProvider --> FilterByQuota[Filter by<br/>quota cooldown status]

    FilterByQuota --> AnyCreds{Any credentials<br/>available?}
    AnyCreds -->|No| Return403C[Return 403 Forbidden<br/>No auth available]
    AnyCreds -->|Yes| SelectCred

    SelectCred[Selector picks credential<br/>RoundRobin or FillFirst]
    SelectCred --> ExecuteRequest[Execute request with<br/>selected credential]

    ExecuteRequest --> Success[Return response to client]

    style ExtractKey fill:#3498DB
    style CheckLimits fill:#E74C3C
    style AuthManager fill:#9B59B6
    style SelectCred fill:#2ECC71
    style Success fill:#27AE60
```

### 4. OAuth Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant WebUI as Management Web UI
    participant Server as AIProxyAPI Server
    participant OAuth as OAuth Provider<br/>(Anthropic/Google/GitHub)
    participant Storage as Auth Storage

    User->>WebUI: Click "Authenticate with Claude"
    WebUI->>Server: GET /v0/management/anthropic-auth-url

    Server->>Server: Generate PKCE codes
    Server->>Server: Generate state token
    Server->>Server: RegisterOAuthSession(state)

    Server-->>WebUI: Return {url: "https://claude.ai/oauth/authorize?...", state: "..."}

    WebUI->>User: Display auth URL
    User->>User: Open URL in browser

    User->>OAuth: Navigate to OAuth provider
    OAuth->>User: Show login/consent page
    User->>OAuth: Complete authentication

    OAuth->>User: Redirect to http://localhost:54545/callback?code=XXX&state=YYY

    Note over User: Browser shows "Connection refused"<br/>User copies the full callback URL

    User->>WebUI: Paste callback URL into form
    WebUI->>Server: POST /v0/management/oauth-callback<br/>{provider: "anthropic", redirect_url: "..."}

    Server->>Server: Extract code and state from URL
    Server->>Server: Validate state matches session
    Server->>Server: Write callback to temp file

    Note over Server: Background goroutine wakes up

    Server->>Server: Read callback file
    Server->>OAuth: POST /v1/oauth/token<br/>{code, client_id, code_verifier, ...}
    OAuth-->>Server: {access_token, refresh_token, ...}

    Server->>Storage: Save tokens to auth file<br/>anthropic-email@example.com.json
    Storage-->>Server: Saved

    Server->>Server: CompleteOAuthSession(state)
    Server-->>WebUI: {status: "ok"}
    WebUI-->>User: "Authentication successful!"

    Note over User,Storage: Credential is now available for API requests
```

### 5. Model Registry & Provider Routing

```mermaid
flowchart TB
    Request[Client requests<br/>model: gemini-2.5-flash] --> Registry[Model Registry]

    Registry --> LookupProviders{GetModelProviders}
    LookupProviders --> ProvidersFound[Providers:<br/>- gemini-cli<br/>- gemini<br/>- vertex]

    ProvidersFound --> AuthManager[Auth Manager]

    AuthManager --> FilterByRestrictions{Filter by<br/>allowedProviders?}
    FilterByRestrictions -->|Yes| FilteredProviders[Filtered Providers:<br/>- gemini]
    FilterByRestrictions -->|No| AllProviders[All Providers:<br/>- gemini-cli<br/>- gemini<br/>- vertex]

    FilteredProviders --> GetCreds
    AllProviders --> GetCreds

    GetCreds[Get credentials for providers] --> CredList

    CredList[Available Credentials:<br/>- gemini-cli: user@email.json<br/>- vertex: service-account.json] --> Selector

    Selector{Credential Selector}
    Selector -->|RoundRobin| RR[Pick next in rotation]
    Selector -->|FillFirst| FF[Pick first until quota exceeded]

    RR --> SelectedCred
    FF --> SelectedCred

    SelectedCred[Selected:<br/>gemini-cli: user@email.json] --> RefCount

    RefCount[Update Reference Count<br/>in Model Registry] --> Execute

    Execute[Execute with<br/>selected credential] --> CheckResponse

    CheckResponse{Response Status}
    CheckResponse -->|Success| UpdateSuccess[Update registry:<br/>Available clients++]
    CheckResponse -->|Quota Error| UpdateQuota[Update registry:<br/>Suspend model]
    CheckResponse -->|Other Error| Retry{Retry?}

    Retry -->|Yes, attempts < 3| GetCreds
    Retry -->|No| ReturnError[Return error to client]

    UpdateSuccess --> ReturnResponse[Return response to client]
    UpdateQuota --> ReturnError

    style Registry fill:#9B59B6
    style Selector fill:#3498DB
    style Execute fill:#2ECC71
    style UpdateSuccess fill:#27AE60
    style UpdateQuota fill:#E74C3C
```

### 6. Component Relationships

```mermaid
graph LR
    subgraph "HTTP Layer"
        Router[Gin Router]
        Middleware[Middleware Chain]
    end

    subgraph "Access Control"
        AccessMgr[Access Manager]
        Limits[Limits Enforcer]
    end

    subgraph "Request Processing"
        Handlers[API Handlers]
        BaseHandler[Base Handler]
    end

    subgraph "Credential Management"
        AuthMgr[Auth Manager]
        Selector[Credential Selector]
        Auths[(Auth Entries)]
    end

    subgraph "Model Management"
        Registry[Model Registry]
        Models[(Model Definitions)]
    end

    subgraph "Protocol Translation"
        Translators[Translators]
        OpenAIFmt[OpenAI Format]
        ClaudeFmt[Claude Format]
        GeminiFmt[Gemini Format]
    end

    subgraph "Execution"
        Executors[Provider Executors]
        HTTPClient[HTTP Client]
    end

    subgraph "Storage"
        Storage[Storage Interface]
        FileStore[File Store]
        PostgresStore[Postgres Store]
        GitStore[Git Store]
        S3Store[S3 Store]
    end

    Router --> Middleware
    Middleware --> AccessMgr
    Middleware --> Limits
    Middleware --> Handlers

    Handlers --> BaseHandler
    BaseHandler --> AuthMgr
    BaseHandler --> Registry

    AuthMgr --> Selector
    AuthMgr --> Auths
    AuthMgr --> Translators

    Selector --> Auths
    Selector --> Registry

    Registry --> Models

    Translators --> OpenAIFmt
    Translators --> ClaudeFmt
    Translators --> GeminiFmt

    AuthMgr --> Executors
    Executors --> HTTPClient

    Auths --> Storage
    Storage --> FileStore
    Storage --> PostgresStore
    Storage --> GitStore
    Storage --> S3Store

    AccessMgr -.validates.-> Limits
    Limits -.restricts.-> AuthMgr

    style Router fill:#4A90E2
    style AuthMgr fill:#E74C3C
    style Registry fill:#9B59B6
    style Translators fill:#2ECC71
    style Storage fill:#F39C12
```

---

## 🛠️ Tech Stack

### **Core Framework**
- **Language**: Go 1.21+
- **HTTP Server**: [Gin](https://github.com/gin-gonic/gin) v1.10.0
- **Logging**: [Logrus](https://github.com/sirupsen/logrus) v1.9.3

### **Authentication & Security**
- **OAuth 2.0**: Custom implementation with PKCE
- **JWT**: [golang-jwt/jwt](https://github.com/golang-jwt/jwt) v5.2.1
- **Password Hashing**: [bcrypt](https://pkg.go.dev/golang.org/x/crypto/bcrypt)
- **Session Management**: In-memory with state tokens

### **Storage**
- **File System**: Native Go file I/O
- **PostgreSQL**: [pgx](https://github.com/jackc/pgx) v5.7.1
- **Git**: [go-git](https://github.com/go-git/go-git) v5.12.0
- **S3/MinIO**: [minio-go](https://github.com/minio/minio-go) v7.0.77

### **HTTP & Networking**
- **HTTP Client**: `net/http` with retry logic
- **WebSocket**: [gorilla/websocket](https://github.com/gorilla/websocket) v1.5.3
- **CORS**: [gin-contrib/cors](https://github.com/gin-contrib/cors) v1.7.2
- **Proxy**: SOCKS5 support via [golang.org/x/net/proxy](https://pkg.go.dev/golang.org/x/net/proxy)

### **Configuration**
- **YAML**: [gopkg.in/yaml.v3](https://gopkg.in/yaml.v3)
- **File Watching**: [fsnotify](https://github.com/fsnotify/fsnotify) v1.7.0
- **Hot Reload**: Custom watcher implementation

### **AI Provider SDKs**
- **Google Gemini**: [google.golang.org/api/aiplatform](https://pkg.go.dev/google.golang.org/api/aiplatform)
- **Anthropic**: Custom HTTP client
- **OpenAI**: Custom HTTP client (OpenAI-compatible format)

### **Testing**
- **Framework**: Go standard `testing` package
- **HTTP Testing**: `httptest`
- **Assertions**: Table-driven tests

### **Build & Deployment**
- **Build**: Native Go toolchain
- **Containerization**: Docker support
- **Process Management**: Systemd, Supervisor, or native

### **Frontend (Management UI)**
- **Framework**: Vanilla JavaScript (ES6+)
- **Styling**: Custom CSS
- **Build**: No build step required
- **Hosting**: Embedded in Go binary or CDN

---

## 📊 How It Handles Requests (Detailed)

### **1. API Key Validation**
- Extract `Authorization: Bearer <key>` header
- Lookup in `config.api-keys` array
- Support bcrypt-hashed keys for security
- Store validated key in Gin context

### **2. Request Limits Enforcement**
- Extract model name from JSON body
- Pattern match against `api-key-limits.allowed-models` (wildcards supported)
- Check monthly quota: `api-key-limits.monthly-quotas`
- If exceeded: Return 403 with quota info
- Set `allowedCredentials` and `allowedProviders` in context for downstream filtering

### **3. Model Resolution**
- Parse model name (e.g., `claude-sonnet-4-20250514`)
- Extract provider (e.g., `claude`)
- Query Model Registry for available providers
- Filter by `allowedProviders` from limits context

### **4. Credential Selection**
- Get all credentials for matching providers
- Filter by `allowedCredentials` from limits context
- Filter out quota-exceeded credentials (cooldown)
- Apply selection strategy:
  - **RoundRobin**: Distribute requests evenly
  - **FillFirst**: Use first credential until quota, then next

### **5. Protocol Translation**
- **OpenAI → Gemini**: Convert to `contents`, `parts`, `generationConfig`
- **OpenAI → Claude**: Convert to `messages`, `max_tokens`, `system`
- **Response reverse**: Convert back to OpenAI format with `choices`, `usage`

### **6. Request Execution**
- Build HTTP request with provider-specific headers
- Apply credential authentication (OAuth token, API key, service account)
- Execute with retry logic (3 attempts, exponential backoff)
- Handle quota errors with cooldown (suspend for 60 seconds)

### **7. Usage Tracking**
- Count tokens from response `usage` field
- Update `usage-statistics.json` with:
  - API key
  - Model name
  - Request count
  - Month/year
- Periodic flush to disk (every 5 minutes)

### **8. Error Handling**
- **401 Unauthorized**: Invalid API key
- **403 Forbidden**: Quota exceeded or model not allowed
- **404 Not Found**: Model not available
- **429 Too Many Requests**: Provider rate limit
- **500 Internal Server Error**: Execution failure
- **503 Service Unavailable**: No credentials available

### **9. Response Streaming**
- Detect `stream: true` in request
- Use chunked transfer encoding
- Send SSE events: `data: {...}\n\n`
- Flush after each chunk
- Send `data: [DONE]\n\n` at end

---

## 🔑 Key Features

✅ **Multi-Provider Support**: Claude, Gemini, Codex, Qwen, Copilot, iFlow, Vertex
✅ **OpenAI-Compatible API**: Drop-in replacement for OpenAI API
✅ **OAuth Authentication**: Automatic token refresh for all providers
✅ **Credential Management**: File/PostgreSQL/Git/S3 storage
✅ **API Key Limits**: Per-key model restrictions and monthly quotas
✅ **Load Balancing**: RoundRobin and FillFirst strategies
✅ **Hot Reload**: Configuration changes without restart
✅ **Protocol Translation**: Automatic format conversion
✅ **Usage Tracking**: Detailed statistics and quota enforcement
✅ **Management UI**: Web-based control panel
✅ **Streaming Support**: Server-Sent Events for real-time responses
✅ **Retry Logic**: Automatic retry with exponential backoff
✅ **Quota Cooldown**: Automatic credential rotation on quota errors

---

## 📝 Summary

AIProxyAPI is a production-grade AI API gateway that:
- Provides a unified OpenAI-compatible interface to 7+ AI providers
- Handles authentication, quota management, and protocol translation
- Supports multiple storage backends and credential types
- Offers fine-grained access control with API key limits
- Includes hot reload, usage tracking, and comprehensive management UI
- Built with Go for performance and reliability
- Designed for self-hosting with minimal dependencies

**Perfect for:**
- Organizations using multiple AI providers
- Teams wanting centralized quota management
- Developers building AI applications with OpenAI SDK
- Self-hosted AI gateway deployments
