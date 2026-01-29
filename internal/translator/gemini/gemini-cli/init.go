package geminiCLI

import (
	. "github.com/giofahreza/AIProxyAPI/internal/constant"
	"github.com/giofahreza/AIProxyAPI/internal/interfaces"
	"github.com/giofahreza/AIProxyAPI/internal/translator/translator"
)

func init() {
	translator.Register(
		GeminiCLI,
		Gemini,
		ConvertGeminiCLIRequestToGemini,
		interfaces.TranslateResponse{
			Stream:     ConvertGeminiResponseToGeminiCLI,
			NonStream:  ConvertGeminiResponseToGeminiCLINonStream,
			TokenCount: GeminiCLITokenCount,
		},
	)
}
