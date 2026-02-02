# Plan: Full Claude Code CLI Support via `/api/anthropic` Endpoint

## Goal

Use Claude Code CLI natively (like an official subscription) with GitHub Copilot, GLM, or any provider configured in the proxy:
```bash
ANTHROPIC_BASE_URL=http://proxy:8317/api/anthropic
ANTHROPIC_API_KEY=your-proxy-api-key
claude  # works natively
```

## Validation Sources

1. **Claude Code CLI binary** (`/usr/local/bin/claude`) — extracted via `strings`
2. **Official Anthropic API docs** (`platform.claude.com/docs/en/api/`)
3. **Official LLM Gateway docs** (`code.claude.com/docs/en/llm-gateway`)

## What Claude Code CLI Sends — Complete Reference

### Endpoints (all prefixed by `ANTHROPIC_BASE_URL`)
| Method | Path | Purpose | Required |
|--------|------|---------|----------|
| `POST` | `/v1/messages` | Main chat (streaming & non-streaming) | **Yes** |
| `POST` | `/v1/messages/count_tokens` | Token counting | **Yes** |
| `GET` | `/v1/models` | Model listing | **Yes** |

### Headers Sent
| Header | Value | Source |
|--------|-------|--------|
| `x-api-key` | API key | `ANTHROPIC_API_KEY` env var |
| `Authorization` | `Bearer <token>` | `ANTHROPIC_AUTH_TOKEN` env var (optional) |
| `Content-Type` | `application/json` | Always |
| `anthropic-version` | `2023-06-01` | Always |
| `anthropic-beta` | Comma-separated beta flags | Dynamic per request |

### All Beta Flags (from binary + official docs)
`interleaved-thinking-2025-05-14`, `context-1m-2025-08-07`, `context-management-2025-06-27`, `structured-outputs-2025-12-15`, `web-search-2025-03-05`, `tool-examples-2025-10-29`, `advanced-tool-use-2025-11-20`, `effort-2025-11-24`, `oauth-2025-04-20`, `mcp-servers-2025-12-04`, `files-api-2025-04-14`, `fine-grained-tool-streaming-2025-05-14`, `claude-code-20250219`, `model-context-window-exceeded-2025-08-26`, `skills-2025-10-02`

### Messages API Parameters (POST `/v1/messages`)
All passed through as-is (proxy does not parse these):

| Parameter | Type | Required |
|-----------|------|----------|
| `model` | string | Yes |
| `messages` | array | Yes |
| `max_tokens` | number | Yes |
| `system` | string or array | No |
| `temperature` | number | No |
| `top_p` | number | No |
| `top_k` | number | No |
| `stop_sequences` | array of string | No |
| `stream` | boolean | No |
| `tools` | array of ToolUnion | No |
| `tool_choice` | ToolChoice | No |
| `thinking` | ThinkingConfig | No |
| `metadata` | object (`user_id`) | No |
| `service_tier` | `"auto"` or `"standard_only"` | No |
| `output_config` | object (`format`) | No |

### Tool Types (sent in `tools` array)
| Type | Name | Used By |
|------|------|---------|
| `custom` (or omitted) | user-defined | Custom tools + MCP tools |
| `bash_20250124` | `bash` | Shell execution |
| `text_editor_20250124` | `str_replace_editor` | File editing (v1) |
| `text_editor_20250429` | `str_replace_based_edit_tool` | File editing (v2) |
| `text_editor_20250728` | `str_replace_based_edit_tool` | File editing (v3, +`max_characters`) |
| `web_search_20250305` | `web_search` | Web search (+`allowed_domains`, `blocked_domains`, `max_uses`, `user_location`) |

### Content Block Types (in messages)
Input: `text`, `image`, `document`, `tool_use`, `tool_result`, `thinking`, `redacted_thinking`, `search_result`, `server_tool_use`, `web_search_tool_result`

### Streaming SSE Events
| Event | Data Type |
|-------|-----------|
| `message_start` | `{type, message: {id, type, role, content, model, stop_reason, usage}}` |
| `content_block_start` | `{type, index, content_block: {type, ...}}` |
| `content_block_delta` | `{type, index, delta: {type: "text_delta"/"input_json_delta"/"thinking_delta"/"signature_delta", ...}}` |
| `content_block_stop` | `{type, index}` |
| `message_delta` | `{type, delta: {stop_reason, stop_sequence}, usage: {output_tokens}}` |
| `message_stop` | `{type}` |
| `ping` | `{type}` |
| `error` | `{type: "error", error: {type, message}}` |

### Error Response Format
```json
{
  "type": "error",
  "error": {
    "type": "authentication_error",
    "message": "Invalid API key"
  }
}
```

Status → error type mapping (from official docs):
- 400 → `invalid_request_error`
- 401 → `authentication_error`
- 403 → `permission_error`
- 404 → `not_found_error`
- 413 → `request_too_large`
- 429 → `rate_limit_error`
- 500 → `api_error`
- 529 → `overloaded_error`

### Models API Response Format (GET `/v1/models`)
Query params: `after_id`, `before_id`, `limit` (default 20, max 1000)
```json
{
  "data": [
    {"id": "claude-sonnet-4-20250514", "type": "model", "display_name": "Claude Sonnet 4", "created_at": "2025-05-14T00:00:00Z"}
  ],
  "has_more": false,
  "first_id": "claude-sonnet-4-20250514",
  "last_id": "claude-3-haiku-20240307"
}
```

### Count Tokens Response Format
```json
{"input_tokens": 123}
```

## Current State of the Proxy

Already working:
- `POST /v1/messages` → streaming + non-streaming via `ClaudeMessages`
- `POST /v1/messages/count_tokens` → via `ClaudeCountTokens`
- `GET /v1/models` → routes to Claude handler when User-Agent starts with `claude-cli`
- Auth via `X-Api-Key` header
- Streaming passthrough for Claude-to-Claude (`from == to` in `ExecuteStream`)
- `anthropic-beta` header forwarding in `applyClaudeHeaders`

**Why passthrough works**: When the backend provider is Claude/Anthropic, the proxy forwards the raw JSON body and streams back the raw SSE response. All the complex parameters (tools, thinking, content blocks, etc.) are handled by the upstream Anthropic API — the proxy doesn't need to parse them.

## Changes Required

### 1. Add `/api/anthropic/v1` Route Group
**File: `internal/api/server.go` (in `setupRoutes()`)**

```go
anthropicAPI := s.engine.Group("/api/anthropic/v1")
anthropicAPI.Use(middleware.AnthropicErrorFormatMiddleware())
anthropicAPI.Use(AuthMiddleware(s.accessManager))
anthropicAPI.Use(middleware.LimitsMiddleware(s.limitsEnforcer))
{
    anthropicAPI.GET("/models", claudeCodeHandlers.ClaudeModels)
    anthropicAPI.POST("/messages", claudeCodeHandlers.ClaudeMessages)
    anthropicAPI.POST("/messages/count_tokens", claudeCodeHandlers.ClaudeCountTokens)
}
```

`AnthropicErrorFormatMiddleware` goes **first** so it wraps the ResponseWriter before auth/limits run.

### 2. Create Anthropic Error Format Middleware
**New file: `internal/api/middleware/anthropic_error.go`**

Problem: Auth middleware returns `{"error": "Missing API key"}` and limits middleware returns OpenAI-format `{"error": {"message": "...", "type": "..."}}`. Neither matches what Claude Code CLI expects.

Implementation: Custom `gin.ResponseWriter` wrapper that:
1. Intercepts `WriteHeader()` — if status >= 400, enters buffering mode
2. Buffers the error response body
3. On flush/close, rewrites to Anthropic format: `{"type": "error", "error": {"type": "<mapped>", "message": "<extracted>"}}`
4. For 2xx responses, passes through unchanged (zero overhead)

Message extraction logic:
- Try `{"error": {"message": "..."}}` (OpenAI format from limits middleware)
- Try `{"error": "..."}` (simple format from auth middleware)
- Fallback to raw body or HTTP status text

### 3. Anthropic Error Format in Handler Error Paths
**File: `sdk/api/handlers/claude/code_handlers.go`**

Add helpers:
```go
func isAnthropicPath(c *gin.Context) bool {
    return strings.HasPrefix(c.Request.URL.Path, "/api/anthropic")
}

func writeAnthropicError(c *gin.Context, status int, msg string) {
    c.JSON(status, gin.H{
        "type": "error",
        "error": gin.H{
            "type":    mapStatusToAnthropicType(status),
            "message": msg,
        },
    })
}

func mapStatusToAnthropicType(status int) string {
    // 400→invalid_request_error, 401→authentication_error, 403→permission_error,
    // 404→not_found_error, 413→request_too_large, 429→rate_limit_error,
    // 529→overloaded_error, 500+→api_error
}
```

In `ClaudeMessages`, `ClaudeCountTokens`, `handleNonStreamingResponse`, `handleStreamingResponse` — when `isAnthropicPath(c)`, use `writeAnthropicError` instead of `WriteErrorResponse`.

Streaming error events already use Anthropic format (`event: error\ndata: {"type":"error",...}`) — no change needed there.

### 4. Forward `anthropic-version` Header to Upstream
**File: `internal/runtime/executor/claude_executor.go` (in `applyClaudeHeaders`)**

Currently hardcodes `anthropic-version: 2023-06-01`. Forward client's header:
```go
if ver := ginHeaders.Get("Anthropic-Version"); ver != "" {
    r.Header.Set("anthropic-version", ver)
} else {
    r.Header.Set("anthropic-version", "2023-06-01")
}
```

### 5. Non-Streaming Passthrough for Claude-to-Claude
**File: `internal/runtime/executor/claude_executor.go` (in `Execute` method)**

Streaming has passthrough (`if from == to`), but non-streaming `Execute` always runs `TranslateNonStream`. Add passthrough:
```go
if from == to {
    reporter.publish(ctx, parseClaudeUsage(data))
    resp = cliproxyexecutor.Response{Payload: data}
    return resp, nil
}
```

### 6. Models Endpoint — Anthropic Format
**File: `sdk/api/handlers/claude/code_handlers.go`**

When accessed via `/api/anthropic`, return official Anthropic models format:
```json
{
  "data": [{"id": "...", "type": "model", "display_name": "...", "created_at": "..."}],
  "has_more": false,
  "first_id": "...",
  "last_id": "..."
}
```

Ensure each model entry has `type: "model"`, `display_name`, and `created_at` fields.

### 7. Update API Info Endpoint
**File: `internal/api/server.go`**

Add `/api/anthropic/v1` to the info listing.

## Files to Modify

| File | Change |
|------|--------|
| `internal/api/server.go` | Add `/api/anthropic/v1` route group + update API info |
| `internal/api/middleware/anthropic_error.go` | **New file** — ResponseWriter wrapper for Anthropic error format |
| `sdk/api/handlers/claude/code_handlers.go` | `isAnthropicPath`/`writeAnthropicError` helpers, use in error paths, models format |
| `internal/runtime/executor/claude_executor.go` | Forward `anthropic-version` + non-streaming passthrough |

## Verification

1. **Build**: `go build ./cmd/server/`

2. **Auth error format**:
   ```bash
   curl -s http://localhost:8317/api/anthropic/v1/messages -H "x-api-key: invalid" -d '{}'
   ```
   Expected: `{"type":"error","error":{"type":"authentication_error","message":"Invalid API key"}}`

3. **Non-streaming**:
   ```bash
   curl -s -X POST http://localhost:8317/api/anthropic/v1/messages \
     -H "Content-Type: application/json" -H "x-api-key: KEY" -H "anthropic-version: 2023-06-01" \
     -d '{"model":"claude-sonnet-4","max_tokens":100,"messages":[{"role":"user","content":"Hi"}]}'
   ```
   Expected: `{"type":"message","id":"...","content":[...],...}`

4. **Streaming**:
   ```bash
   curl -N -X POST http://localhost:8317/api/anthropic/v1/messages \
     -H "Content-Type: application/json" -H "x-api-key: KEY" -H "anthropic-version: 2023-06-01" \
     -d '{"model":"claude-sonnet-4","max_tokens":100,"stream":true,"messages":[{"role":"user","content":"Hi"}]}'
   ```
   Expected: SSE events (`message_start`, `content_block_start`, `content_block_delta`, etc.)

5. **Count tokens**:
   ```bash
   curl -s -X POST http://localhost:8317/api/anthropic/v1/messages/count_tokens \
     -H "Content-Type: application/json" -H "x-api-key: KEY" -H "anthropic-version: 2023-06-01" \
     -d '{"model":"claude-sonnet-4","messages":[{"role":"user","content":"Hello"}]}'
   ```
   Expected: `{"input_tokens": N}`

6. **Models listing**:
   ```bash
   curl -s http://localhost:8317/api/anthropic/v1/models -H "x-api-key: KEY" -H "anthropic-version: 2023-06-01"
   ```
   Expected: `{"data":[{"id":"...","type":"model","display_name":"...","created_at":"..."}],"has_more":false,...}`

7. **Claude Code CLI (real test)**:
   ```bash
   ANTHROPIC_BASE_URL=http://localhost:8317/api/anthropic ANTHROPIC_API_KEY=KEY claude
   ```
   Verify: interactive chat, streaming, tool use (bash, text_editor), extended thinking, web search all work.

8. **Tool use with streaming**:
   ```bash
   curl -N -X POST http://localhost:8317/api/anthropic/v1/messages \
     -H "Content-Type: application/json" -H "x-api-key: KEY" -H "anthropic-version: 2023-06-01" \
     -H "anthropic-beta: claude-code-20250219" \
     -d '{"model":"claude-sonnet-4","max_tokens":1024,"stream":true,"tools":[{"type":"bash_20250124","name":"bash"}],"messages":[{"role":"user","content":"Run echo hello"}]}'
   ```
   Expected: SSE with `tool_use` content block

## Out of Scope

These exist in the binary but are not required for standard Claude Code CLI operation:
- `/v1/files` (Files API) — beta feature, not used in normal chat/tool-use
- `/v1/messages/batches` — batch API
- `/v1/mcp/{server_id}` — remote MCP (goes to separate URL, not ANTHROPIC_BASE_URL)
