// Package limits provides API key restriction and quota enforcement functionality.
package limits

import (
	"fmt"
	"path/filepath"
	"strings"
	"sync"

	"github.com/giofahreza/AIProxyAPI/internal/config"
	"github.com/giofahreza/AIProxyAPI/internal/usage"
)

// Enforcer validates API key access restrictions and monthly quotas.
type Enforcer struct {
	mu     sync.RWMutex
	limits []config.APIKeyLimit
}

// NewEnforcer creates a new limit enforcer with the given API key limits.
func NewEnforcer(limits []config.APIKeyLimit) *Enforcer {
	return &Enforcer{limits: limits}
}

// CheckAccess validates whether an API key can access a specific model.
// It returns an error if access is denied, either due to model restrictions
// or monthly quota limits.
func (e *Enforcer) CheckAccess(apiKey, modelName string) error {
	if e == nil {
		return nil
	}

	e.mu.RLock()
	defer e.mu.RUnlock()

	if len(e.limits) == 0 {
		// No limits configured, allow access
		return nil
	}

	// Find the limit configuration for this API key
	var limit *config.APIKeyLimit
	for i := range e.limits {
		if e.limits[i].APIKey == apiKey {
			limit = &e.limits[i]
			break
		}
	}

	// No limits for this API key, allow access
	if limit == nil {
		return nil
	}

	// Check model restrictions
	if len(limit.AllowedModels) > 0 {
		allowed := false
		for _, allowedModel := range limit.AllowedModels {
			if matchModel(allowedModel, modelName) {
				allowed = true
				break
			}
		}
		if !allowed {
			return fmt.Errorf("model %q is not allowed for this API key", modelName)
		}
	}

	// Check monthly quotas
	if len(limit.MonthlyQuotas) > 0 {
		stats := usage.GetRequestStatistics()
		allUsage := stats.GetMonthlyUsageAllModels(apiKey)

		// Check if there's a quota for this specific model or a matching pattern
		for pattern, quota := range limit.MonthlyQuotas {
			if matchModel(pattern, modelName) {
				// Aggregate usage across all models matching this quota pattern
				var aggregatedUsage int64
				for model, count := range allUsage {
					if matchModel(pattern, model) {
						aggregatedUsage += count
					}
				}
				if aggregatedUsage >= int64(quota) {
					return fmt.Errorf("monthly quota exceeded for model %q (limit: %d, current: %d)",
						modelName, quota, aggregatedUsage)
				}
				// Found a matching quota, no need to check others
				break
			}
		}
	}

	return nil
}

// GetQuotaStatus returns the current usage and limit for a specific API key and model.
func (e *Enforcer) GetQuotaStatus(apiKey, modelName string) (current int64, limit int, hasLimit bool) {
	if e == nil {
		return 0, 0, false
	}

	e.mu.RLock()
	defer e.mu.RUnlock()

	if len(e.limits) == 0 {
		return 0, 0, false
	}

	// Find the limit configuration for this API key
	var limitConfig *config.APIKeyLimit
	for i := range e.limits {
		if e.limits[i].APIKey == apiKey {
			limitConfig = &e.limits[i]
			break
		}
	}

	if limitConfig == nil || len(limitConfig.MonthlyQuotas) == 0 {
		return 0, 0, false
	}

	stats := usage.GetRequestStatistics()
	allUsage := stats.GetMonthlyUsageAllModels(apiKey)

	// Find the quota for this model and aggregate usage across matching models
	for pattern, quota := range limitConfig.MonthlyQuotas {
		if matchModel(pattern, modelName) {
			var aggregatedUsage int64
			for model, count := range allUsage {
				if matchModel(pattern, model) {
					aggregatedUsage += count
				}
			}
			return aggregatedUsage, quota, true
		}
	}

	currentUsage := stats.GetMonthlyUsage(apiKey, modelName)
	return currentUsage, 0, false
}

// GetAllowedCredentials returns the list of allowed credential IDs for an API key.
// If the API key has no credential restrictions, it returns nil (all credentials allowed).
func (e *Enforcer) GetAllowedCredentials(apiKey string) []string {
	if e == nil {
		return nil
	}

	e.mu.RLock()
	defer e.mu.RUnlock()

	if len(e.limits) == 0 {
		return nil
	}

	for i := range e.limits {
		if e.limits[i].APIKey == apiKey {
			if len(e.limits[i].AllowedCredentials) == 0 {
				return nil // No restrictions
			}
			return e.limits[i].AllowedCredentials
		}
	}

	return nil // No restrictions
}

// GetAllowedProviders returns the list of allowed provider identifiers for an API key.
// If the API key has no provider restrictions, it returns nil (all providers allowed).
func (e *Enforcer) GetAllowedProviders(apiKey string) []string {
	if e == nil {
		return nil
	}

	e.mu.RLock()
	defer e.mu.RUnlock()

	if len(e.limits) == 0 {
		return nil
	}

	for i := range e.limits {
		if e.limits[i].APIKey == apiKey {
			if len(e.limits[i].AllowedProviders) == 0 {
				return nil // No restrictions
			}
			return e.limits[i].AllowedProviders
		}
	}

	return nil // No restrictions
}

// GetAllowedModels returns the list of allowed models for an API key.
// If the API key has no restrictions, it returns nil (all models allowed).
func (e *Enforcer) GetAllowedModels(apiKey string) []string {
	if e == nil {
		return nil
	}

	e.mu.RLock()
	defer e.mu.RUnlock()

	if len(e.limits) == 0 {
		return nil
	}

	for i := range e.limits {
		if e.limits[i].APIKey == apiKey {
			if len(e.limits[i].AllowedModels) == 0 {
				return nil // No restrictions
			}
			return e.limits[i].AllowedModels
		}
	}

	return nil // No restrictions
}

// matchModel checks if a model name matches a pattern.
// Supports wildcard patterns using * (e.g., "gpt-*", "*-turbo", "claude-*").
func matchModel(pattern, modelName string) bool {
	if pattern == modelName {
		return true
	}

	// Use filepath.Match for glob-style pattern matching
	matched, err := filepath.Match(pattern, modelName)
	if err != nil {
		// If pattern is invalid, fall back to exact match
		return pattern == modelName
	}
	return matched
}

// IsModelAllowed checks if a model is allowed for a specific API key.
func (e *Enforcer) IsModelAllowed(apiKey, modelName string) bool {
	if e == nil {
		return true
	}

	e.mu.RLock()
	defer e.mu.RUnlock()

	if len(e.limits) == 0 {
		return true
	}

	for i := range e.limits {
		if e.limits[i].APIKey == apiKey {
			if len(e.limits[i].AllowedModels) == 0 {
				return true // No restrictions means all allowed
			}

			for _, allowedModel := range e.limits[i].AllowedModels {
				if matchModel(allowedModel, modelName) {
					return true
				}
			}
			return false
		}
	}

	return true // No limits for this API key
}

// GetMonthlyUsageSummary returns a summary of usage for all models for a specific API key.
func (e *Enforcer) GetMonthlyUsageSummary(apiKey string) map[string]UsageSummary {
	if e == nil {
		return nil
	}

	e.mu.RLock()
	defer e.mu.RUnlock()

	stats := usage.GetRequestStatistics()
	allUsage := stats.GetMonthlyUsageAllModels(apiKey)

	// Find the limit configuration for this API key
	var limitConfig *config.APIKeyLimit
	for i := range e.limits {
		if e.limits[i].APIKey == apiKey {
			limitConfig = &e.limits[i]
			break
		}
	}

	result := make(map[string]UsageSummary)

	// Add usage for models with quotas
	if limitConfig != nil && len(limitConfig.MonthlyQuotas) > 0 {
		for pattern, quota := range limitConfig.MonthlyQuotas {
			// For each pattern, find matching models in usage
			for modelName, current := range allUsage {
				if matchModel(pattern, modelName) {
					result[modelName] = UsageSummary{
						Current:  current,
						Limit:    quota,
						HasLimit: true,
					}
				}
			}
		}
	}

	// Add usage for models without quotas
	for modelName, current := range allUsage {
		if _, exists := result[modelName]; !exists {
			result[modelName] = UsageSummary{
				Current:  current,
				Limit:    0,
				HasLimit: false,
			}
		}
	}

	return result
}

// UsageSummary contains usage information for a model.
type UsageSummary struct {
	Current  int64
	Limit    int
	HasLimit bool
}

// Reload updates the enforcer with new API key limits.
func (e *Enforcer) Reload(limits []config.APIKeyLimit) {
	if e != nil {
		e.mu.Lock()
		e.limits = limits
		e.mu.Unlock()
	}
}

// NormalizeModelName normalizes a model name for comparison by trimming and lowercasing.
func NormalizeModelName(modelName string) string {
	return strings.ToLower(strings.TrimSpace(modelName))
}
