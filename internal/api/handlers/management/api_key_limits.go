package management

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/giofahreza/AIProxyAPI/internal/config"
)

// GetAPIKeyLimits retrieves the current API key limits configuration.
func (h *Handler) GetAPIKeyLimits(c *gin.Context) {
	h.mu.Lock()
	cfg := h.cfg
	h.mu.Unlock()

	if cfg == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "configuration not available"})
		return
	}

	// Return the API key limits array
	limits := cfg.APIKeyLimits
	if limits == nil {
		limits = []config.APIKeyLimit{}
	}

	c.JSON(http.StatusOK, gin.H{"api_key_limits": limits})
}

// PutAPIKeyLimits replaces the entire API key limits configuration.
func (h *Handler) PutAPIKeyLimits(c *gin.Context) {
	var req struct {
		APIKeyLimits []config.APIKeyLimit `json:"api_key_limits"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body: " + err.Error()})
		return
	}

	h.mu.Lock()
	cfg := h.cfg
	h.mu.Unlock()

	if cfg == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "configuration not available"})
		return
	}

	// Update the configuration
	cfg.APIKeyLimits = req.APIKeyLimits
	cfg.SanitizeAPIKeyLimits()

	// Persist the configuration
	if !h.persist(c) {
		return
	}

	c.JSON(http.StatusOK, gin.H{"api_key_limits": cfg.APIKeyLimits})
}

// PatchAPIKeyLimit adds or updates a single API key limit entry.
func (h *Handler) PatchAPIKeyLimit(c *gin.Context) {
	var req config.APIKeyLimit

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body: " + err.Error()})
		return
	}

	// Validate that API key is provided
	if strings.TrimSpace(req.APIKey) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "api_key field is required"})
		return
	}

	h.mu.Lock()
	cfg := h.cfg
	h.mu.Unlock()

	if cfg == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "configuration not available"})
		return
	}

	// Find existing entry or add new one
	found := false
	for i := range cfg.APIKeyLimits {
		if cfg.APIKeyLimits[i].APIKey == req.APIKey {
			// Update existing entry
			cfg.APIKeyLimits[i] = req
			found = true
			break
		}
	}

	if !found {
		// Add new entry
		cfg.APIKeyLimits = append(cfg.APIKeyLimits, req)
	}

	// Sanitize the configuration
	cfg.SanitizeAPIKeyLimits()

	// Persist the configuration
	if !h.persist(c) {
		return
	}

	c.JSON(http.StatusOK, gin.H{"api_key_limits": cfg.APIKeyLimits})
}

// DeleteAPIKeyLimit removes a specific API key limit entry.
func (h *Handler) DeleteAPIKeyLimit(c *gin.Context) {
	apiKey := c.Query("api_key")
	if strings.TrimSpace(apiKey) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "api_key query parameter is required"})
		return
	}

	h.mu.Lock()
	cfg := h.cfg
	h.mu.Unlock()

	if cfg == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "configuration not available"})
		return
	}

	// Find and remove the entry
	found := false
	newLimits := make([]config.APIKeyLimit, 0, len(cfg.APIKeyLimits))
	for i := range cfg.APIKeyLimits {
		if cfg.APIKeyLimits[i].APIKey == apiKey {
			found = true
			continue
		}
		newLimits = append(newLimits, cfg.APIKeyLimits[i])
	}

	if !found {
		c.JSON(http.StatusNotFound, gin.H{"error": "API key limit not found"})
		return
	}

	cfg.APIKeyLimits = newLimits

	// Persist the configuration
	if !h.persist(c) {
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "API key limit deleted", "api_key_limits": cfg.APIKeyLimits})
}
