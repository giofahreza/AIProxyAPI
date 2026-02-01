# Claude Code CLI Integration - Issues & Fixes

## Executive Summary
Your proxy is **breaking Claude Code CLI** due to 3 critical issues:

1. **Authorization Header Deletion** - Proxy deletes Bearer tokens needed for upstream authentication
2. **Missing Claude Code Direct API Support** - Proxy designed for OAuth-based CLI tools, not direct API key auth
3. **Streaming Response Handling** - Proxy may strip necessary headers for Claude Code SSE streaming

---

## Issue #1: Authorization Header Deletion (CRITICAL)

### Location
`internal/api/modules/amp/proxy.go:71-73`

### Problem
```go
// Remove client's Authorization header - it was only used for CLI Proxy API authentication
// We will set our own Authorization using the configured upstream-api-key
req.Header.Del("Authorization")
req.Header.Del("X-Api-Key")
req.Header.Del("X-Goog-Api-Key")
```

This code deletes the Authorization header that Claude Code sends. The proxy was designed to:
1. Accept Bearer token from CLI client
2. Replace it with upstream-api-key

But Claude Code needs this header passed through to the actual Claude API!

### Impact
When Claude Code sends: `Authorization: Bearer sk-ant-...`
The proxy deletes it and tries to use `upstream-api-key` from config instead.

### Solution
The proxy must distinguish between:
1. **OAuth CLI clients** (Gemini, Copilot, etc.) - DELETE the header, use upstream-api-key
2. **Direct API consumers** (Claude Code) - PRESERVE the header

---

## Issue #2: Missing Claude Code Direct API Support

### Problem
The proxy is designed as an OAuth bridge for CLI tools:
- Handles OAuth flows
- Expects credentials in `~/.cli-proxy-api/`
- Maps to upstream Amp server

Claude Code needs:
- Direct Claude API key pass-through
- No OAuth flow
- Direct API.anthropic.com routing OR custom base URL

### Solution
Add a "direct" mode that:
1. Accepts Bearer tokens directly
2. Routes to actual provider APIs (claude, openai, gemini)
3. Bypasses Amp routing for direct requests

---

## Issue #3: Streaming Response Headers

### Problem
SSE streaming (Server-Sent Events) requires proper headers:
- `Content-Type: text/event-stream`
- `Transfer-Encoding: chunked` or explicit `Content-Length`
- Must NOT be compressed

The proxy's `ModifyResponse` handler might interfere with streaming headers.

### Solution
Ensure streaming responses bypass all response modification logic.

---

## Implementation Strategy

### Phase 1: Fix Authorization Header Handling (5 min)
- Detect if request is "direct API" vs "OAuth CLI"
- Pass through authorization header for direct API
- Keep original logic for OAuth CLI

### Phase 2: Add Claude Code Header Support (10 min)
- Add `X-Claude-Code-Client` header detection
- Route direct requests properly
- Handle both Bearer tokens and API keys

### Phase 3: Validate Streaming (5 min)
- Test SSE response handling
- Ensure `text/event-stream` responses bypass modifications
- Verify chunked encoding is preserved

---

## Testing Strategy

```bash
# Test 1: Direct API call with Bearer token
curl -X POST http://localhost:8317/v1/chat/completions \
  -H "Authorization: Bearer sk-ant-..." \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-sonnet-4","messages":[{"role":"user","content":"test"}]}'

# Test 2: Streaming response
curl -X POST http://localhost:8317/v1/chat/completions \
  -H "Authorization: Bearer sk-ant-..." \
  -H "Content-Type: application/json" \
  -d '{"model":"claude-sonnet-4","messages":[...],"stream":true}'

# Test 3: Claude Code CLI (requires Claude Code installation)
ANTHROPIC_BASE_URL=http://localhost:8317 \
ANTHROPIC_API_KEY=sk-ant-... \
claude --version
```

---

## Files to Modify

1. `internal/api/modules/amp/proxy.go` - Fix authorization header handling
2. `internal/api/modules/amp/routes.go` - Add direct API route detection
3. `internal/api/server.go` - Add Claude Code detection middleware (optional)

---

## Backward Compatibility

All changes maintain backward compatibility with existing OAuth CLI clients:
- Amp routing still works
- OAuth flows unchanged
- Upstream-api-key still used for Amp clients

---

## Claude Code CLI Configuration

After fixes, users can run:

```bash
# Option 1: Using proxy as base URL
export ANTHROPIC_BASE_URL=http://your-server:8317
export ANTHROPIC_API_KEY=your-actual-claude-api-key
claude

# Option 2: Using CLI tool directly (no proxy needed)
export ANTHROPIC_API_KEY=your-actual-claude-api-key
claude
```

No special proxy configuration needed - just Claude API keys!

