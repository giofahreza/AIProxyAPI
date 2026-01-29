// Package store provides persistent storage implementations for the CLI Proxy API.
package store

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

// FileStore implements file-based persistent storage for usage statistics.
// It stores usage statistics as a JSON file in a configured directory,
// following the same pattern as OAuth credential storage.
type FileStore struct {
	mu       sync.Mutex
	filePath string
}

// NewFileStore creates a new file-based storage instance.
// The baseDir parameter specifies the directory where the usage statistics file will be stored.
// If baseDir is empty or does not exist, an error is returned.
func NewFileStore(baseDir string) (*FileStore, error) {
	if baseDir == "" {
		return nil, fmt.Errorf("file store: base directory cannot be empty")
	}

	// Ensure the directory exists
	if info, err := os.Stat(baseDir); err != nil {
		if os.IsNotExist(err) {
			// Try to create the directory
			if mkdirErr := os.MkdirAll(baseDir, 0o755); mkdirErr != nil {
				return nil, fmt.Errorf("file store: failed to create directory %s: %w", baseDir, mkdirErr)
			}
		} else {
			return nil, fmt.Errorf("file store: failed to access directory %s: %w", baseDir, err)
		}
	} else if !info.IsDir() {
		return nil, fmt.Errorf("file store: %s is not a directory", baseDir)
	}

	filePath := filepath.Join(baseDir, "usage-statistics.json")

	return &FileStore{
		filePath: filePath,
	}, nil
}

// SaveUsageStatistics persists the usage statistics snapshot to a JSON file.
// The data parameter should be a JSON-encoded byte slice.
// The file is written atomically using a temporary file and rename.
func (s *FileStore) SaveUsageStatistics(ctx context.Context, data []byte) error {
	if s == nil {
		return fmt.Errorf("file store: not initialized")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	// Write to a temporary file first for atomic operation
	tmpPath := s.filePath + ".tmp"
	if err := os.WriteFile(tmpPath, data, 0o600); err != nil {
		return fmt.Errorf("file store: failed to write temporary file: %w", err)
	}

	// Rename the temporary file to the actual file (atomic on most systems)
	if err := os.Rename(tmpPath, s.filePath); err != nil {
		_ = os.Remove(tmpPath) // Clean up temporary file on error
		return fmt.Errorf("file store: failed to rename temporary file: %w", err)
	}

	return nil
}

// LoadUsageStatistics retrieves the usage statistics snapshot from the JSON file.
// If the file does not exist, it returns nil without error (indicating no previous statistics).
// If the file exists but cannot be read, an error is returned.
func (s *FileStore) LoadUsageStatistics(ctx context.Context) ([]byte, error) {
	if s == nil {
		return nil, fmt.Errorf("file store: not initialized")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := os.ReadFile(s.filePath)
	if err != nil {
		if os.IsNotExist(err) {
			// File doesn't exist yet - this is normal on first run
			return nil, nil
		}
		return nil, fmt.Errorf("file store: failed to read file: %w", err)
	}

	return data, nil
}
