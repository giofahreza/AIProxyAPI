package anthropic

import (
	"encoding/json"
	"strings"
	"testing"
)

// prettyJSON formats raw JSON bytes for readability
func prettyJSON(t *testing.T, data []byte) string {
	t.Helper()
	var buf json.RawMessage = data
	pretty, err := json.MarshalIndent(buf, "", "  ")
	if err != nil {
		t.Fatalf("failed to pretty-print JSON: %v", err)
	}
	return string(pretty)
}

// TestConvertSimpleUserMessage verifies that a simple text user message
// produces string content, not an array.
func TestConvertSimpleUserMessage(t *testing.T) {
	input := []byte(`{
		"model": "claude-sonnet-4-20250514",
		"max_tokens": 1024,
		"messages": [
			{
				"role": "user",
				"content": [
					{"type": "text", "text": "Hello, how are you?"}
				]
			}
		]
	}`)

	result := ConvertAnthropicRequestToOpenAI("gpt-4o", input, false)
	pretty := prettyJSON(t, result)
	t.Logf("=== Simple User Message Output ===\n%s", pretty)

	// Verify content is a string, not an array
	if strings.Contains(pretty, `"content": [`) {
		t.Error("FAIL: user message content is an array, expected a string")
	}
	if !strings.Contains(pretty, `"content": "Hello, how are you?"`) {
		t.Error("FAIL: expected string content 'Hello, how are you?'")
	}
}

// TestConvertSystemMessage verifies that system messages use string format.
func TestConvertSystemMessage(t *testing.T) {
	input := []byte(`{
		"model": "claude-sonnet-4-20250514",
		"max_tokens": 1024,
		"system": [
			{"type": "text", "text": "You are a helpful coding assistant."}
		],
		"messages": [
			{
				"role": "user",
				"content": [
					{"type": "text", "text": "Write hello world in Go"}
				]
			}
		]
	}`)

	result := ConvertAnthropicRequestToOpenAI("gpt-4o", input, false)
	pretty := prettyJSON(t, result)
	t.Logf("=== System Message Output ===\n%s", pretty)

	// Check that system message is present with string content
	if !strings.Contains(pretty, `"role": "system"`) {
		t.Error("FAIL: no system message found")
	}
	// System content should be a plain string
	if !strings.Contains(pretty, `"You are a helpful coding assistant."`) {
		t.Error("FAIL: system content not found as string")
	}
}

// TestConvertGPT4oNoRFCHint verifies that well-known models like gpt-4o
// do NOT get the RFC 8259 hint prepended to system messages.
func TestConvertGPT4oNoRFCHint(t *testing.T) {
	input := []byte(`{
		"model": "claude-sonnet-4-20250514",
		"max_tokens": 1024,
		"system": "Be concise.",
		"messages": [
			{
				"role": "user",
				"content": "Hi"
			}
		]
	}`)

	result := ConvertAnthropicRequestToOpenAI("gpt-4o", input, false)
	pretty := prettyJSON(t, result)
	t.Logf("=== GPT-4o (no RFC hint) Output ===\n%s", pretty)

	if strings.Contains(string(result), "RFC 8259") {
		t.Error("FAIL: gpt-4o output contains RFC 8259 hint - should be skipped for well-known models")
	}
	if !strings.Contains(string(result), "Be concise.") {
		t.Error("FAIL: system content 'Be concise.' not found")
	}
}

// TestConvertUnknownModelNoRFCHint verifies that NO model gets the RFC 8259 hint.
// RFC 8259 hint was removed entirely as modern models handle JSON natively.
func TestConvertUnknownModelNoRFCHint(t *testing.T) {
	input := []byte(`{
		"model": "claude-sonnet-4-20250514",
		"max_tokens": 1024,
		"system": "Be concise.",
		"messages": [
			{
				"role": "user",
				"content": "Hi"
			}
		]
	}`)

	result := ConvertAnthropicRequestToOpenAI("my-custom-model-v1", input, false)
	pretty := prettyJSON(t, result)
	t.Logf("=== Unknown Model (no RFC hint) Output ===\n%s", pretty)

	if strings.Contains(string(result), "RFC 8259") {
		t.Error("FAIL: unknown model output contains RFC 8259 hint - should never be included")
	}
	if !strings.Contains(string(result), "Be concise.") {
		t.Error("FAIL: system content 'Be concise.' not found")
	}
}

// TestConvertRealisticCodeCLIRequest simulates a realistic Claude Code CLI request
// with system prompt, tools, tool_choice, and a multi-turn conversation including
// tool use and tool results.
func TestConvertRealisticCodeCLIRequest(t *testing.T) {
	input := []byte(`{
		"model": "claude-sonnet-4-20250514",
		"max_tokens": 8096,
		"temperature": 0.0,
		"system": [
			{
				"type": "text",
				"text": "You are Claude Code, an AI assistant made by Anthropic. You help users with coding tasks.",
				"cache_control": {"type": "ephemeral"}
			},
			{
				"type": "text",
				"text": "Guidelines:\n- Be concise\n- Use tools when needed\n- Always explain your reasoning"
			}
		],
		"tools": [
			{
				"name": "Read",
				"description": "Read a file from the filesystem",
				"input_schema": {
					"type": "object",
					"properties": {
						"file_path": {
							"type": "string",
							"description": "Absolute path to the file"
						}
					},
					"required": ["file_path"]
				}
			},
			{
				"name": "Bash",
				"description": "Execute a bash command",
				"input_schema": {
					"type": "object",
					"properties": {
						"command": {
							"type": "string",
							"description": "The command to run"
						}
					},
					"required": ["command"]
				}
			}
		],
		"tool_choice": {"type": "auto"},
		"messages": [
			{
				"role": "user",
				"content": [
					{"type": "text", "text": "Read the file /tmp/test.go and tell me what it does"}
				]
			},
			{
				"role": "assistant",
				"content": [
					{"type": "text", "text": "I'll read that file for you."},
					{
						"type": "tool_use",
						"id": "toolu_01ABC123",
						"name": "Read",
						"input": {"file_path": "/tmp/test.go"}
					}
				]
			},
			{
				"role": "user",
				"content": [
					{
						"type": "tool_result",
						"tool_use_id": "toolu_01ABC123",
						"content": [
							{"type": "text", "text": "package main\n\nfunc main() {\n\tprintln(\"hello\")\n}"}
						]
					}
				]
			},
			{
				"role": "assistant",
				"content": [
					{"type": "text", "text": "This is a simple Go program that prints \"hello\" to stdout."}
				]
			},
			{
				"role": "user",
				"content": [
					{"type": "text", "text": "Now run it"}
				]
			}
		],
		"stream": true
	}`)

	result := ConvertAnthropicRequestToOpenAI("gpt-4o", input, true)
	pretty := prettyJSON(t, result)
	t.Logf("=== Realistic Code CLI Request Output ===\n%s", pretty)

	// Verify key structural properties
	if !strings.Contains(pretty, `"model": "gpt-4o"`) {
		t.Error("FAIL: model not set to gpt-4o")
	}
	if !strings.Contains(pretty, `"stream": true`) {
		t.Error("FAIL: stream not set to true")
	}
	if !strings.Contains(pretty, `"role": "system"`) {
		t.Error("FAIL: system message missing")
	}
	if !strings.Contains(pretty, `"role": "tool"`) {
		t.Error("FAIL: tool result message missing")
	}
	if !strings.Contains(pretty, `"tool_calls"`) {
		t.Error("FAIL: tool_calls missing from assistant message")
	}
	if !strings.Contains(pretty, `"tools"`) {
		t.Error("FAIL: tools array missing")
	}
	if !strings.Contains(pretty, `"tool_choice": "auto"`) {
		t.Error("FAIL: tool_choice not mapped to 'auto'")
	}
	// Verify no RFC hint for gpt-4o
	if strings.Contains(string(result), "RFC 8259") {
		t.Error("FAIL: gpt-4o should NOT have RFC 8259 hint")
	}

	// Count messages - should be: system, user, assistant(with tool_calls), tool, assistant, user
	msgCount := strings.Count(pretty, `"role":`)
	t.Logf("Total messages with roles: %d", msgCount)
}

// TestConvertNoRFC8259HintForAnyModel verifies that no RFC 8259 hint is ever injected
// regardless of the model name. The hint was removed entirely.
func TestConvertNoRFC8259HintForAnyModel(t *testing.T) {
	models := []string{
		"gpt-4o", "my-custom-model", "deepseek-chat",
		"qwen-72b", "llama-3.1-70b", "",
	}

	for _, model := range models {
		input := []byte(`{"system":"test","messages":[{"role":"user","content":"hi"}]}`)
		result := ConvertAnthropicRequestToOpenAI(model, input, false)
		if strings.Contains(string(result), "RFC 8259") {
			t.Errorf("FAIL: model %q should NOT have RFC 8259 hint but does", model)
		}
	}
}
