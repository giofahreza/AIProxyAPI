// Package management provides the management API handlers and middleware
// for configuring the server and managing auth files.
package management

import (
	"crypto/subtle"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/giofahreza/AIProxyAPI/internal/buildinfo"
	"github.com/giofahreza/AIProxyAPI/internal/config"
	"github.com/giofahreza/AIProxyAPI/internal/usage"
	sdkAuth "github.com/giofahreza/AIProxyAPI/sdk/auth"
	coreauth "github.com/giofahreza/AIProxyAPI/sdk/cliproxy/auth"
	"golang.org/x/crypto/bcrypt"
)

type attemptInfo struct {
	count        int
	blockedUntil time.Time
}

// Handler aggregates config reference, persistence path and helpers.
type Handler struct {
	cfg                 *config.Config
	configFilePath      string
	mu                  sync.Mutex
	attemptsMu          sync.Mutex
	failedAttempts      map[string]*attemptInfo // keyed by client IP
	authManager         *coreauth.Manager
	usageStats          *usage.RequestStatistics
	tokenStore          coreauth.Store
	localPassword       string
	allowRemoteOverride bool
	envSecret           string
	logDir              string
	onLimitsChanged     func([]config.APIKeyLimit)
	jwtSigningKey       []byte
}

// NewHandler creates a new management handler instance.
func NewHandler(cfg *config.Config, configFilePath string, manager *coreauth.Manager) *Handler {
	envSecret, _ := os.LookupEnv("MANAGEMENT_PASSWORD")
	envSecret = strings.TrimSpace(envSecret)

	// Generate JWT signing key
	signingKey, err := generateSigningKey()
	if err != nil {
		// Fallback to empty key; JWT features will be disabled
		fmt.Fprintf(os.Stderr, "warning: failed to generate JWT signing key: %v\n", err)
		signingKey = nil
	}

	return &Handler{
		cfg:                 cfg,
		configFilePath:      configFilePath,
		failedAttempts:      make(map[string]*attemptInfo),
		authManager:         manager,
		usageStats:          usage.GetRequestStatistics(),
		tokenStore:          sdkAuth.GetTokenStore(),
		allowRemoteOverride: envSecret != "",
		envSecret:           envSecret,
		jwtSigningKey:       signingKey,
	}
}

// NewHandler creates a new management handler instance.
func NewHandlerWithoutConfigFilePath(cfg *config.Config, manager *coreauth.Manager) *Handler {
	return NewHandler(cfg, "", manager)
}

// SetConfig updates the in-memory config reference when the server hot-reloads.
func (h *Handler) SetConfig(cfg *config.Config) { h.cfg = cfg }

// SetAuthManager updates the auth manager reference used by management endpoints.
func (h *Handler) SetAuthManager(manager *coreauth.Manager) { h.authManager = manager }

// SetUsageStatistics allows replacing the usage statistics reference.
func (h *Handler) SetUsageStatistics(stats *usage.RequestStatistics) { h.usageStats = stats }

// SetLocalPassword configures the runtime-local password accepted for localhost requests.
func (h *Handler) SetLocalPassword(password string) { h.localPassword = password }

// SetOnLimitsChanged registers a callback invoked whenever API key limits are
// modified through the management API so the caller can reload the enforcer.
func (h *Handler) SetOnLimitsChanged(fn func([]config.APIKeyLimit)) { h.onLimitsChanged = fn }

// SetLogDirectory updates the directory where main.log should be looked up.
func (h *Handler) SetLogDirectory(dir string) {
	if dir == "" {
		return
	}
	if !filepath.IsAbs(dir) {
		if abs, err := filepath.Abs(dir); err == nil {
			dir = abs
		}
	}
	h.logDir = dir
}

// Middleware enforces access control for management endpoints.
// All requests (local and remote) require a valid management key.
// Additionally, remote access requires allow-remote-management=true.
func (h *Handler) Middleware() gin.HandlerFunc {
	const maxFailures = 5
	const banDuration = 30 * time.Minute

	return func(c *gin.Context) {
		c.Header("X-CPA-VERSION", buildinfo.Version)
		c.Header("X-CPA-COMMIT", buildinfo.Commit)
		c.Header("X-CPA-BUILD-DATE", buildinfo.BuildDate)

		clientIP := c.ClientIP()
		localClient := clientIP == "127.0.0.1" || clientIP == "::1"
		cfg := h.cfg
		var (
			allowRemote bool
			secretHash  string
		)
		if cfg != nil {
			allowRemote = cfg.RemoteManagement.AllowRemote
			secretHash = cfg.RemoteManagement.SecretKey
		}
		if h.allowRemoteOverride {
			allowRemote = true
		}
		envSecret := h.envSecret

		fail := func() {}
		if !localClient {
			h.attemptsMu.Lock()
			ai := h.failedAttempts[clientIP]
			if ai != nil {
				if !ai.blockedUntil.IsZero() {
					if time.Now().Before(ai.blockedUntil) {
						remaining := time.Until(ai.blockedUntil).Round(time.Second)
						h.attemptsMu.Unlock()
						c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": fmt.Sprintf("IP banned due to too many failed attempts. Try again in %s", remaining)})
						return
					}
					// Ban expired, reset state
					ai.blockedUntil = time.Time{}
					ai.count = 0
				}
			}
			h.attemptsMu.Unlock()

			if !allowRemote {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "remote management disabled"})
				return
			}

			fail = func() {
				h.attemptsMu.Lock()
				aip := h.failedAttempts[clientIP]
				if aip == nil {
					aip = &attemptInfo{}
					h.failedAttempts[clientIP] = aip
				}
				aip.count++
				if aip.count >= maxFailures {
					aip.blockedUntil = time.Now().Add(banDuration)
					aip.count = 0
				}
				h.attemptsMu.Unlock()
			}
		}
		if secretHash == "" && envSecret == "" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "remote management key not set"})
			return
		}

		// Accept either Authorization: Bearer <key> or X-Management-Key
		var provided string
		if ah := c.GetHeader("Authorization"); ah != "" {
			parts := strings.SplitN(ah, " ", 2)
			if len(parts) == 2 && strings.ToLower(parts[0]) == "bearer" {
				provided = parts[1]
			} else {
				provided = ah
			}
		}
		if provided == "" {
			provided = c.GetHeader("X-Management-Key")
		}

		if provided == "" {
			if !localClient {
				fail()
			}
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing management key"})
			return
		}

		// Try JWT verification first if token looks like a JWT (contains two dots)
		if strings.Count(provided, ".") == 2 && h.jwtSigningKey != nil {
			if _, err := verifyJWT(provided, h.jwtSigningKey, clientIP); err == nil {
				// Valid JWT token
				if !localClient {
					h.clearFailedAttempts(clientIP)
				}
				c.Next()
				return
			}
			// JWT verification failed, fall through to password validation
		}

		// Password validation
		if h.validatePassword(provided, clientIP) {
			if !localClient {
				h.clearFailedAttempts(clientIP)
			}
			c.Next()
			return
		}

			// Authentication failed
			if !localClient {
				fail()
			}
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid management key"})
	}
}

// recordFailedAttempt increments failed attempt counter and may trigger IP ban
func (h *Handler) recordFailedAttempt(clientIP string) {
	const maxFailures = 5
	const banDuration = 30 * time.Minute

	h.attemptsMu.Lock()
	defer h.attemptsMu.Unlock()

	ai := h.failedAttempts[clientIP]
	if ai == nil {
		ai = &attemptInfo{}
		h.failedAttempts[clientIP] = ai
	}
	ai.count++
	if ai.count >= maxFailures {
		ai.blockedUntil = time.Now().Add(banDuration)
		ai.count = 0
	}
}

// clearFailedAttempts resets the failed attempt counter for an IP
func (h *Handler) clearFailedAttempts(clientIP string) {
	h.attemptsMu.Lock()
	defer h.attemptsMu.Unlock()

	if ai := h.failedAttempts[clientIP]; ai != nil {
		ai.count = 0
		ai.blockedUntil = time.Time{}
	}
}

// validatePassword checks if the provided password matches any configured secret.
// Returns true if valid, false otherwise.
func (h *Handler) validatePassword(provided, clientIP string) bool {
	localClient := clientIP == "127.0.0.1" || clientIP == "::1"

	// Check local password for localhost requests
	if localClient {
		if lp := h.localPassword; lp != "" {
			if subtle.ConstantTimeCompare([]byte(provided), []byte(lp)) == 1 {
				return true
			}
		}
	}

	// Check environment secret
	if h.envSecret != "" && subtle.ConstantTimeCompare([]byte(provided), []byte(h.envSecret)) == 1 {
		return true
	}

	// Check bcrypt hashed secret
	cfg := h.cfg
	if cfg != nil {
		secretHash := cfg.RemoteManagement.SecretKey
		if secretHash != "" && bcrypt.CompareHashAndPassword([]byte(secretHash), []byte(provided)) == nil {
			return true
		}
	}

	return false
}

// RateLimitMiddleware checks if the client IP is banned due to too many failed attempts
func (h *Handler) RateLimitMiddleware() gin.HandlerFunc {
	const banDuration = 30 * time.Minute

	return func(c *gin.Context) {
		clientIP := c.ClientIP()
		localClient := clientIP == "127.0.0.1" || clientIP == "::1"

		// Skip rate limiting for local clients
		if localClient {
			c.Next()
			return
		}

		h.attemptsMu.Lock()
		ai := h.failedAttempts[clientIP]
		if ai != nil && !ai.blockedUntil.IsZero() {
			if time.Now().Before(ai.blockedUntil) {
				remaining := time.Until(ai.blockedUntil).Round(time.Second)
				h.attemptsMu.Unlock()
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": fmt.Sprintf("IP banned due to too many failed attempts. Try again in %s", remaining)})
				return
			}
			// Ban expired, reset state
			ai.blockedUntil = time.Time{}
			ai.count = 0
		}
		h.attemptsMu.Unlock()

		c.Next()
	}
}

// Login handles JWT session token issuance
func (h *Handler) Login(c *gin.Context) {
	clientIP := c.ClientIP()
	localClient := clientIP == "127.0.0.1" || clientIP == "::1"

	// Check if remote management is allowed
	cfg := h.cfg
	var allowRemote bool
	if cfg != nil {
		allowRemote = cfg.RemoteManagement.AllowRemote
	}
	if h.allowRemoteOverride {
		allowRemote = true
	}

	if !localClient && !allowRemote {
		c.JSON(http.StatusForbidden, gin.H{"error": "remote management disabled"})
		return
	}

	// Check if any secret is configured
	var secretHash string
	if cfg != nil {
		secretHash = cfg.RemoteManagement.SecretKey
	}
	if secretHash == "" && h.envSecret == "" && h.localPassword == "" {
		c.JSON(http.StatusForbidden, gin.H{"error": "remote management key not set"})
		return
	}

	// Parse request body
	var req struct {
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	// Reject empty or excessively long passwords
	password := strings.TrimSpace(req.Password)
	if password == "" || len(password) > 72 {
		if !localClient {
			h.recordFailedAttempt(clientIP)
		}
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid management key"})
		return
	}

	// Validate password
	if !h.validatePassword(password, clientIP) {
		if !localClient {
			h.recordFailedAttempt(clientIP)
		}
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid management key"})
		return
	}

	// Clear failed attempts on successful login
	if !localClient {
		h.clearFailedAttempts(clientIP)
	}

	// Generate JWT token
	if h.jwtSigningKey == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "JWT signing key not available"})
		return
	}

	now := time.Now()
	claims := jwtClaims{
		IssuedAt:  now.Unix(),
		ExpiresAt: now.Add(jwtTokenDuration).Unix(),
		ClientIP:  clientIP,
	}

	token, err := signJWT(claims, h.jwtSigningKey)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token":      token,
		"expires_at": claims.ExpiresAt,
	})
}

// persist saves the current in-memory config to disk.
func (h *Handler) persist(c *gin.Context) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	// Preserve comments when writing
	if err := config.SaveConfigPreserveComments(h.configFilePath, h.cfg); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to save config: %v", err)})
		return false
	}
	return true
}

// Helper methods for simple types
func (h *Handler) updateBoolField(c *gin.Context, set func(bool)) {
	var body struct {
		Value *bool `json:"value"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.Value == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	set(*body.Value)
	h.persist(c)
}

func (h *Handler) updateIntField(c *gin.Context, set func(int)) {
	var body struct {
		Value *int `json:"value"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.Value == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	set(*body.Value)
	h.persist(c)
}

func (h *Handler) updateStringField(c *gin.Context, set func(string)) {
	var body struct {
		Value *string `json:"value"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.Value == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	set(*body.Value)
	h.persist(c)
}
