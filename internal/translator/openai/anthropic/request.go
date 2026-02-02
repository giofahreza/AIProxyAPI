// Package anthropic provides request translation functionality for Anthropic to OpenAI API.
// It handles parsing and transforming Anthropic API requests into OpenAI Chat Completions API format,
// extracting model information, system instructions, message contents, and tool declarations.
// The package performs JSON data transformation to ensure compatibility
// between Anthropic API format and OpenAI API's expected format.
// Key improvements:
// - System messages use string format (not array)
// - Text-only user/assistant messages use string format (not array)
// - RFC 8259 hint only included for models that need it
package anthropic

import (
	"bytes"
	"strings"

	"github.com/giofahreza/AIProxyAPI/internal/util"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

// needsRFC8259Hint determines if a model needs the RFC 8259 hint for JSON formatting.
// Skip for well-known models that handle JSON natively.
func needsRFC8259Hint(model string) bool {
	lower := strings.ToLower(model)
	prefixes := []string{"gpt-", "claude-", "gemini-", "o1", "o3", "o4"}
	for _, p := range prefixes {
		if strings.HasPrefix(lower, p) {
			return false
		}
	}
	return true
}

// ConvertAnthropicRequestToOpenAI parses and transforms an Anthropic API request into OpenAI Chat Completions API format.
// It extracts the model name, system instruction, message contents, and tool declarations
// from the raw JSON request and returns them in the format expected by the OpenAI API.
// This implementation optimizes request formatting:
// - System message is a string, not an array
// - Text-only user/assistant messages are strings, not arrays
// - RFC 8259 hint only added for models that need it
func ConvertAnthropicRequestToOpenAI(modelName string, inputRawJSON []byte, stream bool) []byte {
	rawJSON := bytes.Clone(inputRawJSON)
	// Base OpenAI Chat Completions API template
	out := `{"model":"","messages":[]}`

	root := gjson.ParseBytes(rawJSON)

	// Model mapping
	out, _ = sjson.Set(out, "model", modelName)

	// Max tokens
	if maxTokens := root.Get("max_tokens"); maxTokens.Exists() {
		out, _ = sjson.Set(out, "max_tokens", maxTokens.Int())
	}

	// Temperature
	if temp := root.Get("temperature"); temp.Exists() {
		out, _ = sjson.Set(out, "temperature", temp.Float())
	} else if topP := root.Get("top_p"); topP.Exists() { // Top P
		out, _ = sjson.Set(out, "top_p", topP.Float())
	}

	// Stop sequences -> stop
	if stopSequences := root.Get("stop_sequences"); stopSequences.Exists() {
		if stopSequences.IsArray() {
			var stops []string
			stopSequences.ForEach(func(_, value gjson.Result) bool {
				stops = append(stops, value.String())
				return true
			})
			if len(stops) > 0 {
				if len(stops) == 1 {
					out, _ = sjson.Set(out, "stop", stops[0])
				} else {
					out, _ = sjson.Set(out, "stop", stops)
				}
			}
		}
	}

	// Stream
	out, _ = sjson.Set(out, "stream", stream)

	// Thinking: Convert Anthropic thinking.budget_tokens to OpenAI reasoning_effort
	if thinking := root.Get("thinking"); thinking.Exists() && thinking.IsObject() {
		if thinkingType := thinking.Get("type"); thinkingType.Exists() {
			switch thinkingType.String() {
			case "enabled":
				if budgetTokens := thinking.Get("budget_tokens"); budgetTokens.Exists() {
					budget := int(budgetTokens.Int())
					if effort, ok := util.ThinkingBudgetToEffort(modelName, budget); ok && effort != "" {
						out, _ = sjson.Set(out, "reasoning_effort", effort)
					}
				} else {
					// No budget_tokens specified, default to "auto" for enabled thinking
					if effort, ok := util.ThinkingBudgetToEffort(modelName, -1); ok && effort != "" {
						out, _ = sjson.Set(out, "reasoning_effort", effort)
					}
				}
			case "disabled":
				if effort, ok := util.ThinkingBudgetToEffort(modelName, 0); ok && effort != "" {
					out, _ = sjson.Set(out, "reasoning_effort", effort)
				}
			}
		}
	}

	// Process messages and system
	var messagesJSON = "[]"

	// Handle system message first - as string, not array
	var systemText strings.Builder
	if needsRFC8259Hint(modelName) {
		systemText.WriteString("Use ANY tool, the parameters MUST accord with RFC 8259 (The JavaScript Object Notation (JSON) Data Interchange Format), the keys and value MUST be enclosed in double quotes.")
	}

	if system := root.Get("system"); system.Exists() {
		if system.Type == gjson.String {
			systemStr := system.String()
			if systemStr != "" {
				if systemText.Len() > 0 {
					systemText.WriteString("\n\n")
				}
				systemText.WriteString(systemStr)
			}
		} else if system.Type == gjson.JSON && system.IsArray() {
			systemResults := system.Array()
			for i := 0; i < len(systemResults); i++ {
				if text, ok := extractContentText(systemResults[i]); ok && text != "" {
					if systemText.Len() > 0 {
						systemText.WriteString("\n\n")
					}
					systemText.WriteString(text)
				}
			}
		}
	}

	if systemText.Len() > 0 {
		systemMsgJSON := `{"role":"system","content":""}`
		systemMsgJSON, _ = sjson.Set(systemMsgJSON, "content", systemText.String())
		messagesJSON, _ = sjson.Set(messagesJSON, "-1", gjson.Parse(systemMsgJSON).Value())
	}

	// Process Anthropic messages
	if messages := root.Get("messages"); messages.Exists() && messages.IsArray() {
		messages.ForEach(func(_, message gjson.Result) bool {
			role := message.Get("role").String()
			contentResult := message.Get("content")

			// Handle content
			if contentResult.Exists() && contentResult.IsArray() {
				var textParts []string
				var reasoningParts []string // Accumulate thinking text for reasoning_content
				var toolCalls []interface{}
				var toolResults []string // Collect tool_result messages to emit after the main message
				var hasImages bool

				contentResult.ForEach(func(_, part gjson.Result) bool {
					partType := part.Get("type").String()

					switch partType {
					case "thinking":
						// Only map thinking to reasoning_content for assistant messages (security: prevent injection)
						if role == "assistant" {
							thinkingText := util.GetThinkingText(part)
							// Skip empty or whitespace-only thinking
							if strings.TrimSpace(thinkingText) != "" {
								reasoningParts = append(reasoningParts, thinkingText)
							}
						}
						// Ignore thinking in user/system roles (AC4)

					case "redacted_thinking":
						// Explicitly ignore redacted_thinking - never map to reasoning_content (AC2)

					case "text":
						if text, ok := extractContentText(part); ok && text != "" {
							textParts = append(textParts, text)
						}

					case "image":
						hasImages = true
						if contentItem, ok := convertAnthropicContentPart(part); ok {
							textParts = append(textParts, contentItem)
						}

					case "tool_use":
						// Only allow tool_use -> tool_calls for assistant messages (security: prevent injection).
						if role == "assistant" {
							toolCallJSON := `{"id":"","type":"function","function":{"name":"","arguments":""}}`
							toolCallJSON, _ = sjson.Set(toolCallJSON, "id", part.Get("id").String())
							toolCallJSON, _ = sjson.Set(toolCallJSON, "function.name", part.Get("name").String())

							// Convert input to arguments JSON string
							if input := part.Get("input"); input.Exists() {
								toolCallJSON, _ = sjson.Set(toolCallJSON, "function.arguments", input.Raw)
							} else {
								toolCallJSON, _ = sjson.Set(toolCallJSON, "function.arguments", "{}")
							}

							toolCalls = append(toolCalls, gjson.Parse(toolCallJSON).Value())
						}

					case "tool_result":
						// Collect tool_result to emit after the main message (ensures tool results follow tool_calls)
						toolResultJSON := `{"role":"tool","tool_call_id":"","content":""}`
						toolResultJSON, _ = sjson.Set(toolResultJSON, "tool_call_id", part.Get("tool_use_id").String())
						toolResultJSON, _ = sjson.Set(toolResultJSON, "content", convertAnthropicToolResultContentToString(part.Get("content")))
						toolResults = append(toolResults, toolResultJSON)
					}
					return true
				})

				// Build reasoning content string
				reasoningContent := ""
				if len(reasoningParts) > 0 {
					reasoningContent = strings.Join(reasoningParts, "\n\n")
				}

				hasContent := len(textParts) > 0
				hasReasoning := reasoningContent != ""
				hasToolCalls := len(toolCalls) > 0
				hasToolResults := len(toolResults) > 0

				// OpenAI requires: tool messages MUST immediately follow the assistant message with tool_calls.
				// Therefore, we emit tool_result messages FIRST (they respond to the previous assistant's tool_calls),
				// then emit the current message's content.
				for _, toolResultJSON := range toolResults {
					messagesJSON, _ = sjson.Set(messagesJSON, "-1", gjson.Parse(toolResultJSON).Value())
				}

				// For assistant messages: emit a single unified message with content, tool_calls, and reasoning_content
				if role == "assistant" {
					if hasContent || hasReasoning || hasToolCalls {
						msgJSON := `{"role":"assistant"}`

						// Add content - use string format when no images and only text
						if hasContent && !hasImages && len(textParts) > 0 {
							// Check if all parts are text (no JSON objects for images)
							allText := true
							for _, part := range textParts {
								if strings.Contains(part, "image_url") {
									allText = false
									break
								}
							}

							if allText {
								// Use string format for text-only content
								msgJSON, _ = sjson.Set(msgJSON, "content", strings.Join(textParts, "\n\n"))
							} else {
								// Use array format when images are present
								contentArrayJSON := "[]"
								for _, textPart := range textParts {
									contentArrayJSON, _ = sjson.SetRaw(contentArrayJSON, "-1", textPart)
								}
								msgJSON, _ = sjson.SetRaw(msgJSON, "content", contentArrayJSON)
							}
						} else if hasContent {
							// Use array format when images are present
							contentArrayJSON := "[]"
							for _, textPart := range textParts {
								contentArrayJSON, _ = sjson.SetRaw(contentArrayJSON, "-1", textPart)
							}
							msgJSON, _ = sjson.SetRaw(msgJSON, "content", contentArrayJSON)
						} else {
							// Ensure content field exists for OpenAI compatibility
							msgJSON, _ = sjson.Set(msgJSON, "content", "")
						}

						// Add reasoning_content if present
						if hasReasoning {
							msgJSON, _ = sjson.Set(msgJSON, "reasoning_content", reasoningContent)
						}

						// Add tool_calls if present (in same message as content)
						if hasToolCalls {
							msgJSON, _ = sjson.Set(msgJSON, "tool_calls", toolCalls)
						}

						messagesJSON, _ = sjson.Set(messagesJSON, "-1", gjson.Parse(msgJSON).Value())
					}
				} else {
					// For non-assistant roles: emit content message if we have content
					if hasContent {
						msgJSON := `{"role":""}`
						msgJSON, _ = sjson.Set(msgJSON, "role", role)

						// Use string format when no images and only text
						if !hasImages && len(textParts) > 0 {
							// Check if all parts are text
							allText := true
							for _, part := range textParts {
								if strings.Contains(part, "image_url") {
									allText = false
									break
								}
							}

							if allText {
								// Use string format for text-only content
								msgJSON, _ = sjson.Set(msgJSON, "content", strings.Join(textParts, "\n\n"))
							} else {
								// Use array format when images are present
								contentArrayJSON := "[]"
								for _, textPart := range textParts {
									contentArrayJSON, _ = sjson.SetRaw(contentArrayJSON, "-1", textPart)
								}
								msgJSON, _ = sjson.SetRaw(msgJSON, "content", contentArrayJSON)
							}
						} else {
							// Use array format when images are present
							contentArrayJSON := "[]"
							for _, textPart := range textParts {
								contentArrayJSON, _ = sjson.SetRaw(contentArrayJSON, "-1", textPart)
							}
							msgJSON, _ = sjson.SetRaw(msgJSON, "content", contentArrayJSON)
						}

						messagesJSON, _ = sjson.Set(messagesJSON, "-1", gjson.Parse(msgJSON).Value())
					} else if hasToolResults && !hasContent {
						// tool_results already emitted above, no additional user message needed
					}
				}

			} else if contentResult.Exists() && contentResult.Type == gjson.String {
				// Simple string content - use string format
				msgJSON := `{"role":"","content":""}`
				msgJSON, _ = sjson.Set(msgJSON, "role", role)
				msgJSON, _ = sjson.Set(msgJSON, "content", contentResult.String())
				messagesJSON, _ = sjson.Set(messagesJSON, "-1", gjson.Parse(msgJSON).Value())
			}

			return true
		})
	}

	// Set messages
	if gjson.Parse(messagesJSON).IsArray() && len(gjson.Parse(messagesJSON).Array()) > 0 {
		out, _ = sjson.SetRaw(out, "messages", messagesJSON)
	}

	// Process tools - convert Anthropic tools to OpenAI functions
	if tools := root.Get("tools"); tools.Exists() && tools.IsArray() {
		var toolsJSON = "[]"

		tools.ForEach(func(_, tool gjson.Result) bool {
			openAIToolJSON := `{"type":"function","function":{"name":"","description":""}}`
			openAIToolJSON, _ = sjson.Set(openAIToolJSON, "function.name", tool.Get("name").String())
			openAIToolJSON, _ = sjson.Set(openAIToolJSON, "function.description", tool.Get("description").String())

			// Convert Anthropic input_schema to OpenAI function parameters
			if inputSchema := tool.Get("input_schema"); inputSchema.Exists() {
				openAIToolJSON, _ = sjson.Set(openAIToolJSON, "function.parameters", inputSchema.Value())
			}

			toolsJSON, _ = sjson.Set(toolsJSON, "-1", gjson.Parse(openAIToolJSON).Value())
			return true
		})

		if gjson.Parse(toolsJSON).IsArray() && len(gjson.Parse(toolsJSON).Array()) > 0 {
			out, _ = sjson.SetRaw(out, "tools", toolsJSON)
		}
	}

	// Tool choice mapping - convert Anthropic tool_choice to OpenAI format
	if toolChoice := root.Get("tool_choice"); toolChoice.Exists() {
		switch toolChoice.Get("type").String() {
		case "auto":
			out, _ = sjson.Set(out, "tool_choice", "auto")
		case "any":
			out, _ = sjson.Set(out, "tool_choice", "required")
		case "tool":
			// Specific tool choice
			toolName := toolChoice.Get("name").String()
			toolChoiceJSON := `{"type":"function","function":{"name":""}}`
			toolChoiceJSON, _ = sjson.Set(toolChoiceJSON, "function.name", toolName)
			out, _ = sjson.SetRaw(out, "tool_choice", toolChoiceJSON)
		default:
			// Default to auto if not specified
			out, _ = sjson.Set(out, "tool_choice", "auto")
		}
	}

	// Handle user parameter (for tracking)
	if user := root.Get("user"); user.Exists() {
		out, _ = sjson.Set(out, "user", user.String())
	}

	return []byte(out)
}

// extractContentText extracts text from a content part
func extractContentText(part gjson.Result) (string, bool) {
	partType := part.Get("type").String()
	if partType == "text" {
		text := part.Get("text").String()
		if strings.TrimSpace(text) == "" {
			return "", false
		}
		return text, true
	}
	return "", false
}

// convertAnthropicContentPart converts a content part to OpenAI format
func convertAnthropicContentPart(part gjson.Result) (string, bool) {
	partType := part.Get("type").String()

	switch partType {
	case "text":
		text := part.Get("text").String()
		if strings.TrimSpace(text) == "" {
			return "", false
		}
		textContent := `{"type":"text","text":""}`
		textContent, _ = sjson.Set(textContent, "text", text)
		return textContent, true

	case "image":
		var imageURL string

		if source := part.Get("source"); source.Exists() {
			sourceType := source.Get("type").String()
			switch sourceType {
			case "base64":
				mediaType := source.Get("media_type").String()
				if mediaType == "" {
					mediaType = "application/octet-stream"
				}
				data := source.Get("data").String()
				if data != "" {
					imageURL = "data:" + mediaType + ";base64," + data
				}
			case "url":
				imageURL = source.Get("url").String()
			}
		}

		if imageURL == "" {
			imageURL = part.Get("url").String()
		}

		if imageURL == "" {
			return "", false
		}

		imageContent := `{"type":"image_url","image_url":{"url":""}}`
		imageContent, _ = sjson.Set(imageContent, "image_url.url", imageURL)

		return imageContent, true

	default:
		return "", false
	}
}

// convertAnthropicToolResultContentToString converts tool result content to string
func convertAnthropicToolResultContentToString(content gjson.Result) string {
	if !content.Exists() {
		return ""
	}

	if content.Type == gjson.String {
		return content.String()
	}

	if content.IsArray() {
		var parts []string
		content.ForEach(func(_, item gjson.Result) bool {
			switch {
			case item.Type == gjson.String:
				parts = append(parts, item.String())
			case item.IsObject() && item.Get("text").Exists() && item.Get("text").Type == gjson.String:
				parts = append(parts, item.Get("text").String())
			default:
				parts = append(parts, item.Raw)
			}
			return true
		})

		joined := strings.Join(parts, "\n\n")
		if strings.TrimSpace(joined) != "" {
			return joined
		}
		return content.Raw
	}

	if content.IsObject() {
		if text := content.Get("text"); text.Exists() && text.Type == gjson.String {
			return text.String()
		}
		return content.Raw
	}

	return content.Raw
}
