package executor

import (
	"bufio"
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	copilotauth "github.com/router-for-me/CLIProxyAPI/v6/internal/auth/copilot"
	"github.com/router-for-me/CLIProxyAPI/v6/internal/config"
	cliproxyauth "github.com/router-for-me/CLIProxyAPI/v6/sdk/cliproxy/auth"
	cliproxyexecutor "github.com/router-for-me/CLIProxyAPI/v6/sdk/cliproxy/executor"
	sdktranslator "github.com/router-for-me/CLIProxyAPI/v6/sdk/translator"
	log "github.com/sirupsen/logrus"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

// CopilotExecutor is a stateless executor for GitHub Copilot using OpenAI-compatible chat completions.
type CopilotExecutor struct {
	cfg *config.Config
}

func NewCopilotExecutor(cfg *config.Config) *CopilotExecutor { return &CopilotExecutor{cfg: cfg} }

func (e *CopilotExecutor) Identifier() string { return "copilot" }

func (e *CopilotExecutor) PrepareRequest(_ *http.Request, _ *cliproxyauth.Auth) error { return nil }

func (e *CopilotExecutor) Execute(ctx context.Context, auth *cliproxyauth.Auth, req cliproxyexecutor.Request, opts cliproxyexecutor.Options) (resp cliproxyexecutor.Response, err error) {
	token, baseURL, err := e.ensureValidToken(ctx, auth)
	if err != nil {
		return resp, fmt.Errorf("failed to get valid Copilot token: %w", err)
	}

	if baseURL == "" {
		baseURL = "https://api.individual.githubcopilot.com"
	}
	reporter := newUsageReporter(ctx, e.Identifier(), req.Model, auth)
	defer reporter.trackFailure(ctx, &err)

	from := opts.SourceFormat
	to := sdktranslator.FromString("openai")
	originalPayload := bytes.Clone(req.Payload)
	if len(opts.OriginalRequest) > 0 {
		originalPayload = bytes.Clone(opts.OriginalRequest)
	}
	originalTranslated := sdktranslator.TranslateRequest(from, to, req.Model, originalPayload, false)
	body := sdktranslator.TranslateRequest(from, to, req.Model, bytes.Clone(req.Payload), false)
	body = ApplyReasoningEffortMetadata(body, req.Metadata, req.Model, "reasoning_effort", false)
	body, _ = sjson.SetBytes(body, "model", req.Model)
	body = NormalizeThinkingConfig(body, req.Model, false)
	if errValidate := ValidateThinkingConfig(body, req.Model); errValidate != nil {
		return resp, errValidate
	}
	body = applyPayloadConfigWithRoot(e.cfg, req.Model, to.String(), "", body, originalTranslated)

	url := strings.TrimSuffix(baseURL, "/") + "/chat/completions"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return resp, err
	}
	// Auto-detect X-Initiator based on message content to control premium request billing
	xInitiator := detectXInitiator(opts, body)
	applyCopilotHeaders(httpReq, token, xInitiator)
	var authID, authLabel, authType, authValue string
	if auth != nil {
		authID = auth.ID
		authLabel = auth.Label
		authType, authValue = auth.AccountInfo()
	}
	recordAPIRequest(ctx, e.cfg, upstreamRequestLog{
		URL:       url,
		Method:    http.MethodPost,
		Headers:   httpReq.Header.Clone(),
		Body:      body,
		Provider:  e.Identifier(),
		AuthID:    authID,
		AuthLabel: authLabel,
		AuthType:  authType,
		AuthValue: authValue,
	})

	httpClient := newProxyAwareHTTPClient(ctx, e.cfg, auth, 0)
	httpResp, err := httpClient.Do(httpReq)
	if err != nil {
		recordAPIResponseError(ctx, e.cfg, err)
		return resp, err
	}
	defer func() {
		if errClose := httpResp.Body.Close(); errClose != nil {
			log.Errorf("copilot executor: close response body error: %v", errClose)
		}
	}()
	recordAPIResponseMetadata(ctx, e.cfg, httpResp.StatusCode, httpResp.Header.Clone())
	if httpResp.StatusCode < 200 || httpResp.StatusCode >= 300 {
		b, _ := io.ReadAll(httpResp.Body)
		appendAPIResponseChunk(ctx, e.cfg, b)
		log.Debugf("request error, error status: %d, error body: %s", httpResp.StatusCode, summarizeErrorBody(httpResp.Header.Get("Content-Type"), b))
		err = statusErr{code: httpResp.StatusCode, msg: string(b)}
		return resp, err
	}
	data, err := io.ReadAll(httpResp.Body)
	if err != nil {
		recordAPIResponseError(ctx, e.cfg, err)
		return resp, err
	}
	appendAPIResponseChunk(ctx, e.cfg, data)
	reporter.publish(ctx, parseOpenAIUsage(data))
	var param any
	out := sdktranslator.TranslateNonStream(ctx, to, from, req.Model, bytes.Clone(opts.OriginalRequest), body, data, &param)
	resp = cliproxyexecutor.Response{Payload: []byte(out)}
	return resp, nil
}

func (e *CopilotExecutor) ExecuteStream(ctx context.Context, auth *cliproxyauth.Auth, req cliproxyexecutor.Request, opts cliproxyexecutor.Options) (stream <-chan cliproxyexecutor.StreamChunk, err error) {
	token, baseURL, err := e.ensureValidToken(ctx, auth)
	if err != nil {
		return nil, fmt.Errorf("failed to get valid Copilot token: %w", err)
	}

	if baseURL == "" {
		baseURL = "https://api.individual.githubcopilot.com"
	}
	reporter := newUsageReporter(ctx, e.Identifier(), req.Model, auth)
	defer reporter.trackFailure(ctx, &err)

	from := opts.SourceFormat
	to := sdktranslator.FromString("openai")
	originalPayload := bytes.Clone(req.Payload)
	if len(opts.OriginalRequest) > 0 {
		originalPayload = bytes.Clone(opts.OriginalRequest)
	}
	originalTranslated := sdktranslator.TranslateRequest(from, to, req.Model, originalPayload, true)
	body := sdktranslator.TranslateRequest(from, to, req.Model, bytes.Clone(req.Payload), true)

	body = ApplyReasoningEffortMetadata(body, req.Metadata, req.Model, "reasoning_effort", false)
	body, _ = sjson.SetBytes(body, "model", req.Model)
	body = NormalizeThinkingConfig(body, req.Model, false)
	if errValidate := ValidateThinkingConfig(body, req.Model); errValidate != nil {
		return nil, errValidate
	}
	body, _ = sjson.SetBytes(body, "stream_options.include_usage", true)
	body = applyPayloadConfigWithRoot(e.cfg, req.Model, to.String(), "", body, originalTranslated)

	url := strings.TrimSuffix(baseURL, "/") + "/chat/completions"
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	// Auto-detect X-Initiator based on message content to control premium request billing
	xInitiator := detectXInitiator(opts, body)
	applyCopilotHeaders(httpReq, token, xInitiator)
	var authID, authLabel, authType, authValue string
	if auth != nil {
		authID = auth.ID
		authLabel = auth.Label
		authType, authValue = auth.AccountInfo()
	}
	recordAPIRequest(ctx, e.cfg, upstreamRequestLog{
		URL:       url,
		Method:    http.MethodPost,
		Headers:   httpReq.Header.Clone(),
		Body:      body,
		Provider:  e.Identifier(),
		AuthID:    authID,
		AuthLabel: authLabel,
		AuthType:  authType,
		AuthValue: authValue,
	})

	httpClient := newProxyAwareHTTPClient(ctx, e.cfg, auth, 0)
	httpResp, err := httpClient.Do(httpReq)
	if err != nil {
		recordAPIResponseError(ctx, e.cfg, err)
		return nil, err
	}
	recordAPIResponseMetadata(ctx, e.cfg, httpResp.StatusCode, httpResp.Header.Clone())
	if httpResp.StatusCode < 200 || httpResp.StatusCode >= 300 {
		b, _ := io.ReadAll(httpResp.Body)
		appendAPIResponseChunk(ctx, e.cfg, b)
		log.Debugf("request error, error status: %d, error body: %s", httpResp.StatusCode, summarizeErrorBody(httpResp.Header.Get("Content-Type"), b))
		if errClose := httpResp.Body.Close(); errClose != nil {
			log.Errorf("copilot executor: close response body error: %v", errClose)
		}
		err = statusErr{code: httpResp.StatusCode, msg: string(b)}
		return nil, err
	}
	out := make(chan cliproxyexecutor.StreamChunk)
	stream = out
	go func() {
		defer close(out)
		defer func() {
			if errClose := httpResp.Body.Close(); errClose != nil {
				log.Errorf("copilot executor: close stream response body error: %v", errClose)
			}
		}()
		scanner := bufio.NewScanner(httpResp.Body)
		scanner.Buffer(nil, 52_428_800) // 50MB
		var param any
		for scanner.Scan() {
			line := scanner.Bytes()
			appendAPIResponseChunk(ctx, e.cfg, line)
			if detail, ok := parseOpenAIStreamUsage(line); ok {
				reporter.publish(ctx, detail)
			}
			chunks := sdktranslator.TranslateStream(ctx, to, from, req.Model, bytes.Clone(opts.OriginalRequest), body, bytes.Clone(line), &param)
			for i := range chunks {
				out <- cliproxyexecutor.StreamChunk{Payload: []byte(chunks[i])}
			}
		}
		doneChunks := sdktranslator.TranslateStream(ctx, to, from, req.Model, bytes.Clone(opts.OriginalRequest), body, bytes.Clone([]byte("[DONE]")), &param)
		for i := range doneChunks {
			out <- cliproxyexecutor.StreamChunk{Payload: []byte(doneChunks[i])}
		}
		if errScan := scanner.Err(); errScan != nil {
			recordAPIResponseError(ctx, e.cfg, errScan)
			reporter.publishFailure(ctx)
			out <- cliproxyexecutor.StreamChunk{Err: errScan}
		}
	}()
	return stream, nil
}

// ensureValidToken retrieves and refreshes Copilot token if needed
func (e *CopilotExecutor) ensureValidToken(ctx context.Context, auth *cliproxyauth.Auth) (token, baseURL string, err error) {
	if auth == nil || auth.Metadata == nil {
		return "", "", fmt.Errorf("auth metadata is required")
	}

	// Get stored tokens
	githubToken, _ := auth.Metadata["github_token"].(string)
	copilotToken, _ := auth.Metadata["copilot_token"].(string)
	copilotExpire, _ := auth.Metadata["copilot_expire"].(string)
	copilotAPIBase, _ := auth.Metadata["copilot_api_base"].(string)

	if githubToken == "" {
		return "", "", fmt.Errorf("github_token not found in metadata")
	}

	// Check if Copilot token needs refresh
	needsRefresh := false
	if copilotToken == "" {
		needsRefresh = true
	} else if copilotExpire != "" {
		expireTime, parseErr := time.Parse(time.RFC3339, copilotExpire)
		if parseErr != nil {
			needsRefresh = true
		} else {
			// Refresh if token expires in less than 5 minutes
			if time.Until(expireTime) < 5*time.Minute {
				needsRefresh = true
			}
		}
	}

	if needsRefresh {
		log.Infof("Copilot token expired or missing, refreshing using GitHub token")
		copilotAuth := copilotauth.NewCopilotAuth(e.cfg)
		tokenData, refreshErr := copilotAuth.RefreshCopilotToken(ctx, githubToken)
		if refreshErr != nil {
			return "", "", fmt.Errorf("failed to refresh Copilot token: %w", refreshErr)
		}

		// Update auth metadata with new token
		auth.Metadata["copilot_token"] = tokenData.CopilotToken
		auth.Metadata["copilot_api_base"] = tokenData.CopilotAPIBase
		auth.Metadata["copilot_expire"] = tokenData.CopilotExpire
		auth.Metadata["last_refresh"] = time.Now().Format(time.RFC3339)
		if tokenData.SKU != "" {
			auth.Metadata["sku"] = tokenData.SKU
		}

		copilotToken = tokenData.CopilotToken
		copilotAPIBase = tokenData.CopilotAPIBase

		log.Infof("Copilot token refreshed successfully (expires: %s, sku: %s)", tokenData.CopilotExpire, tokenData.SKU)
	}

	return copilotToken, copilotAPIBase, nil
}

// applyCopilotHeaders adds required GitHub Copilot headers
// The xInitiator parameter controls premium request billing:
//   - "user": The request counts as a premium request (user-initiated message)
//   - "agent": The request does not consume premium quota (agent/tool-initiated)
//
// When xInitiator is empty, it defaults to "agent" to avoid accidentally consuming
// premium requests for agentic workflows. Clients should explicitly set "user"
// for the initial user-initiated message only.
// See: https://docs.github.com/en/copilot/concepts/billing/copilot-requests
func applyCopilotHeaders(req *http.Request, token string, xInitiator string) {
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "GitHubCopilotChat/1.0")
	req.Header.Set("Editor-Version", "vscode/1.85.0")
	req.Header.Set("Editor-Plugin-Version", "copilot-chat/0.11.1")
	req.Header.Set("Openai-Organization", "github-copilot")
	req.Header.Set("Openai-Intent", "conversation-panel")
	req.Header.Set("Copilot-Integration-Id", "vscode-chat")
	req.Header.Set("VScode-SessionId", randomHex(16))
	req.Header.Set("VScode-MachineId", randomHex(32))
	// X-Initiator controls premium request billing. Default to "agent" to avoid
	// burning premium requests unnecessarily for agentic/tool-initiated flows.
	if xInitiator == "" {
		xInitiator = "agent"
	}
	req.Header.Set("X-Initiator", xInitiator)
}

// randomHex generates a random hex string of specified byte length
func randomHex(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		// Fallback to timestamp-based random on error
		return fmt.Sprintf("%032x", time.Now().UnixNano())[:n*2]
	}
	return hex.EncodeToString(b)
}

// Refresh refreshes the Copilot token using the stored GitHub token
func (e *CopilotExecutor) Refresh(ctx context.Context, auth *cliproxyauth.Auth) (*cliproxyauth.Auth, error) {
	log.Debugf("copilot executor: refresh called")
	if auth == nil {
		return nil, fmt.Errorf("copilot executor: auth is nil")
	}

	// Get GitHub token from metadata
	var githubToken string
	if auth.Metadata != nil {
		if v, ok := auth.Metadata["github_token"].(string); ok && strings.TrimSpace(v) != "" {
			githubToken = v
		}
	}

	if githubToken == "" {
		return nil, fmt.Errorf("copilot executor: github_token not found in metadata")
	}

	log.Infof("copilot executor: refreshing Copilot token using GitHub token")
	copilotAuth := copilotauth.NewCopilotAuth(e.cfg)
	tokenData, err := copilotAuth.RefreshCopilotToken(ctx, githubToken)
	if err != nil {
		return nil, fmt.Errorf("copilot executor: failed to refresh Copilot token: %w", err)
	}

	// Update metadata with new token
	if auth.Metadata == nil {
		auth.Metadata = make(map[string]any)
	}
	auth.Metadata["copilot_token"] = tokenData.CopilotToken
	auth.Metadata["copilot_api_base"] = tokenData.CopilotAPIBase
	auth.Metadata["copilot_expire"] = tokenData.CopilotExpire
	auth.Metadata["last_refresh"] = time.Now().Format(time.RFC3339)
	if tokenData.SKU != "" {
		auth.Metadata["sku"] = tokenData.SKU
	}

	log.Infof("copilot executor: token refreshed successfully (expires: %s, sku: %s)", tokenData.CopilotExpire, tokenData.SKU)
	return auth, nil
}

// CountTokens returns the token count for the given request
func (e *CopilotExecutor) CountTokens(ctx context.Context, auth *cliproxyauth.Auth, req cliproxyexecutor.Request, opts cliproxyexecutor.Options) (cliproxyexecutor.Response, error) {
	from := opts.SourceFormat
	to := sdktranslator.FromString("openai")
	body := sdktranslator.TranslateRequest(from, to, req.Model, bytes.Clone(req.Payload), false)

	modelName := req.Model
	if v := string(body); v != "" {
		if m := extractModelFromJSON(v); m != "" {
			modelName = m
		}
	}

	enc, err := tokenizerForModel(modelName)
	if err != nil {
		return cliproxyexecutor.Response{}, fmt.Errorf("copilot executor: tokenizer init failed: %w", err)
	}

	count, err := countOpenAIChatTokens(enc, body)
	if err != nil {
		return cliproxyexecutor.Response{}, fmt.Errorf("copilot executor: token count failed: %w", err)
	}

	response := fmt.Sprintf(`{"total_tokens":%d}`, count)
	return cliproxyexecutor.Response{Payload: []byte(response)}, nil
}

// extractModelFromJSON extracts the model field from JSON body
func extractModelFromJSON(jsonStr string) string {
	// Simple extraction without importing gjson
	if idx := strings.Index(jsonStr, `"model"`); idx != -1 {
		rest := jsonStr[idx+7:]
		if colon := strings.Index(rest, ":"); colon != -1 {
			rest = strings.TrimSpace(rest[colon+1:])
			if strings.HasPrefix(rest, `"`) {
				rest = rest[1:]
				if end := strings.Index(rest, `"`); end != -1 {
					return rest[:end]
				}
			}
		}
	}
	return ""
}

// detectXInitiator determines the X-Initiator value for GitHub Copilot premium request billing.
// This follows the same logic as OpenCode's copilot-auth implementation:
//   - "user": The request counts as a premium request (user-initiated message)
//   - "agent": The request does not consume premium quota (agent/tool-initiated)
//
// Detection priority:
//  1. If client explicitly set X-Initiator header (via opts.Metadata["x_initiator"]), use that
//  2. Otherwise, auto-detect based on the last message role in the request body:
//     - If last message role is "tool" or "assistant", use "agent"
//     - If last message role is "user", use "user"
//  3. For OpenAI Responses API format (input array), check for agent types
//  4. Default to "agent" if detection fails (safe default to avoid burning premium requests)
//
// See: https://github.com/sst/opencode-copilot-auth/blob/main/index.mjs
func detectXInitiator(opts cliproxyexecutor.Options, body []byte) string {
	// Priority 1: Check if client explicitly set X-Initiator header
	if opts.Metadata != nil {
		if v, ok := opts.Metadata["x_initiator"].(string); ok {
			if val := strings.TrimSpace(v); val != "" {
				return val
			}
		}
	}

	// Priority 2: Auto-detect based on message content (following OpenCode's approach)
	if len(body) > 0 {
		// Check standard messages array format
		messages := gjson.GetBytes(body, "messages")
		if messages.Exists() && messages.IsArray() {
			arr := messages.Array()
			if len(arr) > 0 {
				lastMessage := arr[len(arr)-1]
				role := strings.ToLower(lastMessage.Get("role").String())
				// If last message is from tool or assistant, it's an agent call
				if role == "tool" || role == "assistant" {
					return "agent"
				}
				// If last message is from user, it's a user-initiated call
				if role == "user" {
					return "user"
				}
			}
		}

		// Check OpenAI Responses API format (input array)
		input := gjson.GetBytes(body, "input")
		if input.Exists() && input.IsArray() {
			arr := input.Array()
			if len(arr) > 0 {
				lastInput := arr[len(arr)-1]
				role := strings.ToLower(lastInput.Get("role").String())
				inputType := strings.ToLower(lastInput.Get("type").String())

				// Check for assistant role
				if role == "assistant" {
					return "agent"
				}

				// Check for agent-specific input types (file_search, computer_call, function_call, etc.)
				agentTypes := []string{
					"file_search_call", "computer_call", "computer_call_output",
					"function_call", "function_call_output", "web_search_call",
					"reasoning", "mcp_list_tools", "mcp_call_tool", "mcp_call_tool_result",
				}
				for _, t := range agentTypes {
					if inputType == t {
						return "agent"
					}
				}
			}
		}
	}

	// Default to "agent" to avoid burning premium requests unnecessarily
	return "agent"
}
