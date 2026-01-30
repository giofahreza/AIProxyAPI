// Package middleware provides HTTP middleware for the CLI Proxy API server.
package middleware

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/giofahreza/AIProxyAPI/internal/limits"
	"github.com/giofahreza/AIProxyAPI/sdk/api/handlers"
)

// LimitsMiddleware returns a Gin middleware that enforces API key model restrictions
// and monthly quotas. It reads the model name from the request body and validates
// access before allowing the request to proceed.
func LimitsMiddleware(enforcer *limits.Enforcer) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip if no enforcer is configured
		if enforcer == nil {
			c.Next()
			return
		}

		// Get API key from context (set by AuthMiddleware)
		apiKeyRaw, exists := c.Get("apiKey")
		if !exists {
			// No API key in context, skip validation (likely unauthenticated route)
			c.Next()
			return
		}

		apiKey, ok := apiKeyRaw.(string)
		if !ok || apiKey == "" {
			c.Next()
			return
		}

		// Extract model name from request body
		modelName, err := extractModelFromRequest(c)
		if err != nil || modelName == "" {
			// If we can't extract the model, let it proceed
			// The actual handler will return a proper error for malformed requests
			c.Next()
			return
		}

		// Check access restrictions and quotas
		if err := enforcer.CheckAccess(apiKey, modelName); err != nil {
			status := http.StatusForbidden
			errorBody := handlers.BuildErrorResponseBody(status, err.Error())
			c.Data(status, "application/json; charset=utf-8", errorBody)
			c.Abort()
			return
		}

		// Set allowed credentials on context for downstream credential filtering
		if allowedCreds := enforcer.GetAllowedCredentials(apiKey); len(allowedCreds) > 0 {
			c.Set("allowedCredentials", allowedCreds)
		}

		c.Next()
	}
}

// extractModelFromRequest attempts to extract the model name from the request body.
// It preserves the body for downstream handlers by reading and restoring it.
func extractModelFromRequest(c *gin.Context) (string, error) {
	// Only process POST/PUT/PATCH requests with JSON bodies
	if c.Request.Method != http.MethodPost &&
		c.Request.Method != http.MethodPut &&
		c.Request.Method != http.MethodPatch {
		return "", nil
	}

	contentType := c.GetHeader("Content-Type")
	if contentType != "" && contentType != "application/json" {
		return "", nil
	}

	// Read the body
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		return "", err
	}

	// Restore the body for downstream handlers
	c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

	// Try to parse as JSON
	var reqBody struct {
		Model string `json:"model"`
	}

	if err := json.Unmarshal(bodyBytes, &reqBody); err != nil {
		// Not valid JSON or doesn't have a model field
		return "", nil
	}

	return reqBody.Model, nil
}

// ExtractModelMiddleware extracts the model name from the request and sets it in the context.
// This is useful for handlers that need to access the model name without parsing the body again.
func ExtractModelMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		modelName, err := extractModelFromRequest(c)
		if err == nil && modelName != "" {
			c.Set("requestedModel", modelName)
		}
		c.Next()
	}
}
