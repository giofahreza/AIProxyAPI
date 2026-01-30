package frontend

import "embed"

//go:embed all:css all:js index.html
var EmbeddedFS embed.FS
