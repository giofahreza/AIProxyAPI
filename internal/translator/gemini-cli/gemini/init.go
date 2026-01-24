package gemini

import (
	. "github.com/giofahreza/AIProxyAPI/v6/internal/constant"
	"github.com/giofahreza/AIProxyAPI/v6/internal/interfaces"
	"github.com/giofahreza/AIProxyAPI/v6/internal/translator/translator"
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
