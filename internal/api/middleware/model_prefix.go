package middleware

import (
	"bytes"
	"io"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

// StripModelPrefix is a middleware that removes "{owner}/" prefix from model names
// in request payloads. This allows clients to send model names like "anthropic/claude-3-5-haiku"
// which will be automatically stripped to "claude-3-5-haiku" before routing.
func StripModelPrefix() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Only process endpoints that use model names
		path := c.Request.URL.Path
		if !strings.HasSuffix(path, "/chat/completions") && 
		   !strings.HasSuffix(path, "/completions") &&
		   !strings.HasSuffix(path, "/embeddings") {
			c.Next()
			return
		}

		// Read the request body
		bodyBytes, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.Next()
			return
		}

		// Close the original body
		c.Request.Body.Close()

		// Check if model field exists
		modelValue := gjson.GetBytes(bodyBytes, "model")
		if !modelValue.Exists() {
			// Restore body and continue
			c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
			c.Next()
			return
		}

		modelName := modelValue.String()
		
		// Strip prefix if it contains "/"
		if idx := strings.Index(modelName, "/"); idx > 0 {
			strippedModel := modelName[idx+1:]
			bodyBytes, _ = sjson.SetBytes(bodyBytes, "model", strippedModel)
		}

		// Set the modified body back
		c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))
		
		c.Next()
	}
}
