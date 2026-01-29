package gemini

import (
	. "github.com/giofahreza/AIProxyAPI/internal/constant"
	"github.com/giofahreza/AIProxyAPI/internal/interfaces"
	"github.com/giofahreza/AIProxyAPI/internal/translator/translator"
)

func init() {
	translator.Register(
		Gemini,
		GeminiCLI,
		ConvertGeminiRequestToGeminiCLI,
		interfaces.TranslateResponse{
			Stream:     ConvertGeminiCliResponseToGemini,
			NonStream:  ConvertGeminiCliResponseToGeminiNonStream,
			TokenCount: GeminiTokenCount,
		},
	)
}
