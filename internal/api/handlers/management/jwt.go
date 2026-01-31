package management

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

const (
	jwtTokenDuration = 24 * time.Hour
)

var (
	// ErrInvalidToken is returned when a JWT token is malformed or invalid
	ErrInvalidToken = errors.New("invalid JWT token")
	// ErrTokenExpired is returned when a JWT token has expired
	ErrTokenExpired = errors.New("JWT token expired")
	// ErrIPMismatch is returned when token IP doesn't match client IP
	ErrIPMismatch = errors.New("JWT token IP mismatch")
)

// jwtClaims represents the JWT payload structure
type jwtClaims struct {
	IssuedAt  int64  `json:"iat"`
	ExpiresAt int64  `json:"exp"`
	ClientIP  string `json:"ip"`
}

// generateSigningKey creates a cryptographically secure 32-byte random key
func generateSigningKey() ([]byte, error) {
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		return nil, fmt.Errorf("failed to generate signing key: %w", err)
	}
	return key, nil
}

// signJWT creates a JWT token with the given claims and signing key.
// Returns a token in the format: base64(header).base64(payload).base64(signature)
func signJWT(claims jwtClaims, key []byte) (string, error) {
	// Create header
	header := map[string]string{
		"alg": "HS256",
		"typ": "JWT",
	}
	headerJSON, err := json.Marshal(header)
	if err != nil {
		return "", fmt.Errorf("failed to marshal header: %w", err)
	}
	headerB64 := base64.RawURLEncoding.EncodeToString(headerJSON)

	// Create payload
	payloadJSON, err := json.Marshal(claims)
	if err != nil {
		return "", fmt.Errorf("failed to marshal claims: %w", err)
	}
	payloadB64 := base64.RawURLEncoding.EncodeToString(payloadJSON)

	// Create signature
	message := headerB64 + "." + payloadB64
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(message))
	signature := mac.Sum(nil)
	signatureB64 := base64.RawURLEncoding.EncodeToString(signature)

	return message + "." + signatureB64, nil
}

// verifyJWT validates a JWT token and returns the claims if valid.
// It checks:
// - Token structure (3 parts separated by dots)
// - Signature validity (constant-time comparison)
// - Expiration time
// - Client IP binding
func verifyJWT(token string, key []byte, clientIP string) (*jwtClaims, error) {
	// Split token into parts
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, ErrInvalidToken
	}

	headerB64 := parts[0]
	payloadB64 := parts[1]
	signatureB64 := parts[2]

	// Verify signature
	message := headerB64 + "." + payloadB64
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(message))
	expectedSignature := mac.Sum(nil)

	// Decode provided signature for constant-time comparison
	providedSignature, err := base64.RawURLEncoding.DecodeString(signatureB64)
	if err != nil {
		return nil, ErrInvalidToken
	}

	// Constant-time signature comparison
	if !hmac.Equal(providedSignature, expectedSignature) {
		return nil, ErrInvalidToken
	}

	// Decode and validate payload
	payloadJSON, err := base64.RawURLEncoding.DecodeString(payloadB64)
	if err != nil {
		return nil, ErrInvalidToken
	}

	var claims jwtClaims
	if err := json.Unmarshal(payloadJSON, &claims); err != nil {
		return nil, ErrInvalidToken
	}

	// Check expiration
	now := time.Now().Unix()
	if claims.ExpiresAt < now {
		return nil, ErrTokenExpired
	}

	// Check IP binding
	if claims.ClientIP != clientIP {
		return nil, ErrIPMismatch
	}

	return &claims, nil
}
