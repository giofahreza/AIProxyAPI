package responses

import (
	. "github.com/giofahreza/AIProxyAPI/internal/constant"
	"github.com/giofahreza/AIProxyAPI/internal/interfaces"
	"github.com/giofahreza/AIProxyAPI/internal/translator/translator"
)

func init() {
	translator.Register(
		OpenaiResponse,
		OpenAI,
		ConvertOpenAIResponsesRequestToOpenAIChatCompletions,
		interfaces.TranslateResponse{
			Stream:    ConvertOpenAIChatCompletionsResponseToOpenAIResponses,
			NonStream: ConvertOpenAIChatCompletionsResponseToOpenAIResponsesNonStream,
		},
	)
}
