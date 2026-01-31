package handlers

import (
	"fmt"

	"github.com/gin-gonic/gin"
	log "github.com/sirupsen/logrus"
)

// WriteSSE writes SSE data to the response writer, logging any errors.
func WriteSSE(c *gin.Context, data []byte) {
	if _, err := c.Writer.Write(data); err != nil {
		log.Debugf("SSE write error: %v", err)
	}
}

// WriteSSEFormat writes formatted SSE data to the response writer, logging any errors.
func WriteSSEFormat(c *gin.Context, format string, args ...any) {
	if _, err := fmt.Fprintf(c.Writer, format, args...); err != nil {
		log.Debugf("SSE write error: %v", err)
	}
}
