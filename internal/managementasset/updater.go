package managementasset

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/giofahreza/AIProxyAPI/internal/config"
	"github.com/giofahreza/AIProxyAPI/internal/util"
	log "github.com/sirupsen/logrus"
)

const (
	managementAssetName = "management.html"
	httpUserAgent       = "AIProxyAPI-management-updater"
	updateCheckInterval = 3 * time.Hour
)

// ManagementFileName exposes the control panel asset filename.
const ManagementFileName = managementAssetName

var (
	lastUpdateCheckMu   sync.Mutex
	lastUpdateCheckTime time.Time

	currentConfigPtr    atomic.Pointer[config.Config]
	disableControlPanel atomic.Bool
	schedulerOnce       sync.Once
	schedulerConfigPath atomic.Value
)

// SetCurrentConfig stores the latest configuration snapshot for management asset decisions.
func SetCurrentConfig(cfg *config.Config) {
	if cfg == nil {
		currentConfigPtr.Store(nil)
		return
	}

	prevDisabled := disableControlPanel.Load()
	currentConfigPtr.Store(cfg)
	disableControlPanel.Store(cfg.RemoteManagement.DisableControlPanel)

	if prevDisabled && !cfg.RemoteManagement.DisableControlPanel {
		lastUpdateCheckMu.Lock()
		lastUpdateCheckTime = time.Time{}
		lastUpdateCheckMu.Unlock()
	}
}

// StartAutoUpdater launches a background goroutine that periodically ensures the management asset is up to date.
// It respects the disable-control-panel flag on every iteration and supports hot-reloaded configurations.
func StartAutoUpdater(ctx context.Context, configFilePath string) {
	configFilePath = strings.TrimSpace(configFilePath)
	if configFilePath == "" {
		log.Debug("management asset auto-updater skipped: empty config path")
		return
	}

	schedulerConfigPath.Store(configFilePath)

	schedulerOnce.Do(func() {
		go runAutoUpdater(ctx)
	})
}

func runAutoUpdater(ctx context.Context) {
	if ctx == nil {
		ctx = context.Background()
	}

	ticker := time.NewTicker(updateCheckInterval)
	defer ticker.Stop()

	runOnce := func() {
		cfg := currentConfigPtr.Load()
		if cfg == nil {
			log.Debug("management asset auto-updater skipped: config not yet available")
			return
		}
		if disableControlPanel.Load() {
			log.Debug("management asset auto-updater skipped: control panel disabled")
			return
		}

		configPath, _ := schedulerConfigPath.Load().(string)
		staticDir := StaticDir(configPath)
		EnsureLatestManagementHTML(ctx, staticDir, cfg.ProxyURL, cfg.RemoteManagement.PanelGitHubRepository)
	}

	runOnce()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			runOnce()
		}
	}
}


// StaticDir resolves the directory that stores the management control panel asset.
func StaticDir(configFilePath string) string {
	if override := strings.TrimSpace(os.Getenv("MANAGEMENT_STATIC_PATH")); override != "" {
		cleaned := filepath.Clean(override)
		if strings.EqualFold(filepath.Base(cleaned), managementAssetName) {
			return filepath.Dir(cleaned)
		}
		return cleaned
	}

	if writable := util.WritablePath(); writable != "" {
		return filepath.Join(writable, "static")
	}

	configFilePath = strings.TrimSpace(configFilePath)
	if configFilePath == "" {
		return ""
	}

	base := filepath.Dir(configFilePath)
	fileInfo, err := os.Stat(configFilePath)
	if err == nil {
		if fileInfo.IsDir() {
			base = configFilePath
		}
	}

	return filepath.Join(base, "static")
}

// FilePath resolves the absolute path to the management control panel asset.
func FilePath(configFilePath string) string {
	if override := strings.TrimSpace(os.Getenv("MANAGEMENT_STATIC_PATH")); override != "" {
		cleaned := filepath.Clean(override)
		if strings.EqualFold(filepath.Base(cleaned), managementAssetName) {
			return cleaned
		}
		return filepath.Join(cleaned, ManagementFileName)
	}

	dir := StaticDir(configFilePath)
	if dir == "" {
		return ""
	}
	return filepath.Join(dir, ManagementFileName)
}

// EnsureLatestManagementHTML verifies the local management.html exists and copies from bundled static if needed.
// The function is designed to run in a background goroutine and will never panic.
// It enforces a 3-hour rate limit to avoid frequent checks on config/auth file changes.
func EnsureLatestManagementHTML(ctx context.Context, staticDir string, proxyURL string, panelRepository string) {
	if disableControlPanel.Load() {
		log.Debug("management asset sync skipped: control panel disabled by configuration")
		return
	}

	staticDir = strings.TrimSpace(staticDir)
	if staticDir == "" {
		log.Debug("management asset sync skipped: empty static directory")
		return
	}

	localPath := filepath.Join(staticDir, managementAssetName)

	// Check if local management asset exists
	if _, errStat := os.Stat(localPath); errStat == nil {
		log.Debug("management asset exists locally, skipping update check")
		return
	}

	// Rate limiting: check only once every 3 hours
	lastUpdateCheckMu.Lock()
	now := time.Now()
	timeSinceLastCheck := now.Sub(lastUpdateCheckTime)
	if timeSinceLastCheck < updateCheckInterval {
		lastUpdateCheckMu.Unlock()
		log.Debugf("management asset check skipped: last check was %v ago (interval: %v)", timeSinceLastCheck.Round(time.Second), updateCheckInterval)
		return
	}
	lastUpdateCheckTime = now
	lastUpdateCheckMu.Unlock()

	if errMkdirAll := os.MkdirAll(staticDir, 0o755); errMkdirAll != nil {
		log.WithError(errMkdirAll).Warn("failed to prepare static directory for management asset")
		return
	}

	// Try to copy from bundled static directory (relative to binary)
	bundledPath := filepath.Join("static", managementAssetName)
	if data, err := os.ReadFile(bundledPath); err == nil {
		if err = atomicWriteFile(localPath, data); err != nil {
			log.WithError(err).Warn("failed to copy bundled management asset")
			return
		}
		log.Info("management asset copied from bundled static directory")
		return
	}

	log.Warn("management asset not found: please ensure static/management.html exists in your installation directory")
}

func atomicWriteFile(path string, data []byte) error {
	tmpFile, err := os.CreateTemp(filepath.Dir(path), "management-*.html")
	if err != nil {
		return err
	}

	tmpName := tmpFile.Name()
	defer func() {
		_ = tmpFile.Close()
		_ = os.Remove(tmpName)
	}()

	if _, err = tmpFile.Write(data); err != nil {
		return err
	}

	if err = tmpFile.Chmod(0o644); err != nil {
		return err
	}

	if err = tmpFile.Close(); err != nil {
		return err
	}

	if err = os.Rename(tmpName, path); err != nil {
		return err
	}

	return nil
}
