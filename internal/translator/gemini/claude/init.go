package claude

import (
	. "github.com/giofahreza/AIProxyAPI/internal/constant"
	"github.com/giofahreza/AIProxyAPI/internal/interfaces"
	"github.com/giofahreza/AIProxyAPI/internal/translator/translator"
)

func init() {
	translator.Register(
		Claude,
		Gemini,
		ConvertClaudeRequestToGemini,
		interfaces.TranslateResponse{
			Stream:     ConvertGeminiResponseToClaude,
			NonStream:  ConvertGeminiResponseToClaudeNonStream,
			TokenCount: ClaudeTokenCount,
		},
	)
}
