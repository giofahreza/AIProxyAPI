package anthropic

import (
	. "github.com/giofahreza/AIProxyAPI/internal/constant"
	"github.com/giofahreza/AIProxyAPI/internal/interfaces"
	"github.com/giofahreza/AIProxyAPI/internal/translator/translator"
)

func init() {
	translator.Register(
		Anthropic,
		OpenAI,
		ConvertAnthropicRequestToOpenAI,
		interfaces.TranslateResponse{
			Stream:     ConvertOpenAIResponseToAnthropic,
			NonStream:  ConvertOpenAIResponseToAnthropicNonStream,
			TokenCount: AnthropicTokenCount,
		},
	)
}
