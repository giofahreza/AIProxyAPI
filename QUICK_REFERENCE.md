# Claude Code Multi-Model Quick Reference (2026)

## TL;DR - Copy & Paste Setups

### 1. OpenRouter (Easiest - 2 min)

```bash
export ANTHROPIC_BASE_URL="https://openrouter.ai/api/v1"
export ANTHROPIC_API_KEY="sk-or-v1-<your-key>"
claude
```

**Cost**: Pay-as-you-go, $0-thousands/month
**Models**: 400+
**Setup**: 2 minutes

---

### 2. Claude Sonnet (Direct - 1 min)

```bash
export ANTHROPIC_API_KEY="sk-ant-<your-key>"
claude
```

**Cost**: $100-200/month (Pro)
**Models**: Claude only
**Setup**: 1 minute

---

### 3. Local Ollama (Free - 5 min)

```bash
# Install ollama, then:
ollama pull mistral:7b
ollama serve &

export ANTHROPIC_BASE_URL="http://localhost:11434/api"
export ANTHROPIC_API_KEY="ollama"
claude
```

**Cost**: Free (hardware only)
**Models**: Open-source
**Setup**: 5 minutes

---

### 4. LiteLLM Fallback Chain (Production - 15 min)

```bash
# Install
pip install "litellm[proxy]"

# Create config.yaml
cat > config.yaml << 'EOF'
model_list:
  - model_name: claude-sonnet-4
    litellm_params:
      model: anthropic/claude-3-5-sonnet-20241022
      api_key: ${ANTHROPIC_API_KEY}
  - model_name: claude-sonnet-4
    litellm_params:
      model: gpt-4o
      api_key: ${OPENAI_API_KEY}
fallbacks: [[claude-sonnet-4]]
EOF

# Start
litellm --config config.yaml --port 8000 &

# Use
export ANTHROPIC_BASE_URL="http://localhost:8000"
export ANTHROPIC_API_KEY="sk-litellm"
claude
```

**Cost**: Infrastructure only
**Models**: 100+
**Setup**: 15 minutes

---

### 5. GLM 4.7 (Cheapest - 2 min)

```bash
export ANTHROPIC_BASE_URL="https://api.z.ai/api/anthropic"
export ANTHROPIC_AUTH_TOKEN="<your-z-ai-key>"
claude
```

**Cost**: $3-5/month
**Models**: GLM family
**Setup**: 2 minutes

---

### 6. Qwen 3-Coder (Fast - 2 min)

```bash
export ANTHROPIC_BASE_URL="https://openrouter.ai/api/v1"
export ANTHROPIC_API_KEY="sk-or-v1-<your-key>"
# Then switch in session:
/model openrouter,alibaba/qwen3-coder-plus
claude
```

**Cost**: $5-10/month
**Models**: Qwen family
**Setup**: 2 minutes

---

### 7. Multi-Model Smart Router (Advanced - 20 min)

```bash
# Install
npm install -g claude-code-router

# Create config.json
cat > ~/.claude-code-router/config.json << 'EOF'
{
  "providers": {
    "anthropic": {
      "apiKey": "${ANTHROPIC_API_KEY}",
      "models": {
        "sonnet": "claude-3-5-sonnet-20241022",
        "opus": "claude-opus-4-20250514"
      }
    },
    "openrouter": {
      "apiKey": "${OPENROUTER_API_KEY}",
      "models": {
        "qwen": "alibaba/qwen3-coder-plus",
        "gpt4": "openai/gpt-4o"
      }
    }
  },
  "routing_rules": [
    {
      "pattern": "edit|format",
      "provider": "openrouter",
      "model": "qwen"
    },
    {
      "pattern": ".*",
      "provider": "anthropic",
      "model": "sonnet"
    }
  ]
}
EOF

# Start
claude-code-router start

# Use
export ANTHROPIC_BASE_URL="http://localhost:3000"
claude
```

**Cost**: $5-20/month
**Models**: 20+
**Setup**: 20 minutes

---

## Model Cost Comparison Chart

```
Per 1M Input Tokens (lower = cheaper):

$0.10  ████████████████ GLM 4.5-air
$0.15  ██████████████████ GLM 4.6, 4.7, Kimi K2
$0.20  ████████████████████ Qwen 3-Coder
$0.25  ██████████████████████ DeepSeek V3.2
$3.00  ███████████████████████████████████████ Claude Sonnet
$6.00  ███████████████████████████████████████████████████ GPT-4o
$15.00 ███████████████████████████████████████████████████████████ Claude Opus
```

---

## Model Quality Comparison (SWE-bench Coding)

```
77.2% ████████████████████████ Claude Sonnet 4
74.1% ███████████████████████ GPT-5.2
72.0% ██████████████████████ Gemini 3
68.0% ████████████████████ Qwen 3-Coder
65.0% █████████████████ DeepSeek V3.2
60.0% ████████████████ GLM 4.7
55.0% ██████████████ Llama 70B
```

---

## Estimated Monthly Costs (100K tokens/day usage)

| Model | Tier | Cost | Notes |
|-------|------|------|-------|
| **Ollama (local)** | DIY | $0 | Requires GPU |
| **GLM 4.5-air** | Ultra-cheap | $3 | Lowest cost |
| **Qwen 3-Coder** | Cheap | $8 | Good quality |
| **Claude Sonnet** | Standard | $100 | Best balance |
| **GPT-4o** | Premium | $150 | Good reasoning |
| **Claude Opus** | Expensive | $500 | Best quality |

---

## Feature Compatibility Matrix

| Feature | Claude | GPT-5.2 | Gemini | Qwen | GLM |
|---------|--------|---------|--------|------|-----|
| Tool calling | ✅✅ | ✅ | ✅ | ✅ | ✅ |
| Extended thinking | ✅ | ✅ (o1) | ✅ | ❌ | ❌ |
| Vision | ✅ | ✅ | ✅ | ✅ | ✅ |
| Audio | ❌ | ✅ | ✅ | ❌ | ❌ |
| 200K context | ✅ | ❌ | ❌ | ✅ | ✅ |

---

## Quick Troubleshooting

### "Invalid API key"
```bash
# Check key format
echo $ANTHROPIC_API_KEY
# Should start with sk-ant- (Anthropic) or sk-or- (OpenRouter)

# Test connectivity
curl -X GET $ANTHROPIC_BASE_URL/v1/models \
  -H "Authorization: Bearer $ANTHROPIC_API_KEY"
```

### "Model not found"
```bash
# List available models
curl $ANTHROPIC_BASE_URL/v1/models \
  -H "Authorization: Bearer $ANTHROPIC_API_KEY" | jq .

# Use correct model ID
/model anthropic/claude-3-5-sonnet-20241022
```

### "Rate limited"
```bash
# Try fallback provider
/model openrouter,gpt-4o

# Or switch to cheaper model
/model openrouter,qwen3-coder-base
```

### "Tool use not working"
```bash
# Switch to model with better tool support
/model openrouter,openai/gpt-4o

# Or use Claude directly
export ANTHROPIC_BASE_URL="https://api.anthropic.com"
export ANTHROPIC_API_KEY="sk-ant-..."
```

---

## API Keys You'll Need

| Service | Get Key | Cost |
|---------|---------|------|
| **OpenRouter** | https://openrouter.ai/keys | Free (pay-per-use) |
| **Claude** | https://console.anthropic.com | Free (pay-per-use) |
| **OpenAI** | https://platform.openai.com | Free (pay-per-use) |
| **GLM (Z.AI)** | https://z.ai | Free (pay-per-use) |
| **Qwen** | Via OpenRouter | Free (pay-per-use) |
| **Gemini** | https://makersuite.google.com | Free (pay-per-use) |
| **Ollama** | Local only | Free |

---

## Environment Variable Quick Ref

```bash
# Base URL (provider endpoint)
export ANTHROPIC_BASE_URL="https://api.anthropic.com"
# OR
export ANTHROPIC_BASE_URL="https://openrouter.ai/api/v1"
# OR
export ANTHROPIC_BASE_URL="http://localhost:8000"  # LiteLLM

# API Key
export ANTHROPIC_API_KEY="sk-..."

# For Z.AI (GLM)
export ANTHROPIC_AUTH_TOKEN="..."

# Model selection
export ANTHROPIC_MODEL="claude-sonnet-4"

# Advanced options
export ANTHROPIC_STREAM=true        # Enable streaming
export ANTHROPIC_TIMEOUT=600        # Timeout in seconds
export ANTHROPIC_MAX_RETRIES=3      # Retry count
```

---

## Cost Optimization Shortcuts

### For Simple Tasks (80% of work)
```bash
# Use cheapest model
export ANTHROPIC_MODEL="glm-4-5-air"  # $0.10/1M
# or
export ANTHROPIC_MODEL="qwen3-coder-base"  # $0.20/1M
```

### For Complex Tasks (20% of work)
```bash
# Use best model
export ANTHROPIC_MODEL="claude-opus-4"  # $15/1M
# or
export ANTHROPIC_MODEL="gpt-4o"  # $6/1M
```

### Monthly Budget Control
```bash
# Cheap mode: $5/month
# Use: GLM + Qwen only
export ANTHROPIC_BASE_URL="https://api.z.ai/api/anthropic"

# Balanced mode: $100/month
# Use: Claude Sonnet
export ANTHROPIC_BASE_URL="https://api.anthropic.com"

# Premium mode: $500+/month
# Use: Claude Opus + GPT-4 Turbo
# Set up LiteLLM for routing
```

---

## Common Model Names

```
Cheap:
- glm-4-5-air           ($0.10/1M) ✅
- glm-4-5-vision        ($0.10/1M) ✅
- qwen3-coder-base      ($0.20/1M) ✅
- deepseek-chat         ($0.16/1M) ✅

Standard:
- claude-3-5-sonnet     ($3/1M) ✅
- gpt-4o                ($5/1M) ✅
- gemini-2-flash        ($5/1M) ✅

Premium:
- claude-opus-4         ($15/1M) ✅
- gpt-4-turbo           ($10/1M) ✅
- gpt-5.2 (o1)          Variable ✅
```

---

## Pro Tips

1. **Use model per task**
   - Formatting: GLM 4.5-air
   - Features: Qwen 3-Coder
   - Refactoring: Claude Sonnet
   - Architecture: Claude Opus

2. **Set up aliases**
   ```bash
   alias cc-cheap="ANTHROPIC_MODEL=glm-4-5-air claude"
   alias cc-fast="ANTHROPIC_MODEL=qwen3-coder-base claude"
   alias cc-balanced="ANTHROPIC_MODEL=claude-sonnet-4 claude"
   alias cc-power="ANTHROPIC_MODEL=claude-opus-4 claude"
   ```

3. **Monitor costs**
   ```bash
   # Track in Claude Code
   /cost show    # View token usage
   /cost reset   # Reset counter
   ```

4. **Use fallbacks**
   ```bash
   # Set up LiteLLM to auto-fallback
   # When Claude hits rate limit → try GPT
   # When GPT hits limit → try Qwen
   ```

5. **Clear context often**
   ```bash
   /clear    # Saves tokens and cost
   ```

---

## One-Liner Setups

**Quick test GPT-4o**:
```bash
ANTHROPIC_BASE_URL="https://openrouter.ai/api/v1" ANTHROPIC_API_KEY="sk-or-v1-..." claude
```

**Quick test GLM (free tier)**:
```bash
ANTHROPIC_BASE_URL="https://api.z.ai/api/anthropic" ANTHROPIC_AUTH_TOKEN="..." claude
```

**Quick test local Ollama**:
```bash
ollama pull mistral:7b && ollama serve & sleep 2 && \
ANTHROPIC_BASE_URL="http://localhost:11434/api" ANTHROPIC_API_KEY="ollama" claude
```

---

## When to Use Each Provider

| Situation | Use | Reason |
|-----------|-----|--------|
| **Testing/learning** | OpenRouter | 2-min setup, all models |
| **Production, no budget** | Ollama | Free, private |
| **Production, small budget** | GLM + Router | $10/mo, smart routing |
| **Production, quality first** | Claude direct | Best code quality |
| **Production, cost balanced** | LiteLLM | Fallbacks + caching |
| **Enterprise** | Self-hosted LiteLLM | Full control |

---

## Sources

- [OpenRouter Integration](https://openrouter.ai/docs/guides/guides/claude-code-integration)
- [Claude Code Router](https://github.com/musistudio/claude-code-router)
- [LiteLLM Documentation](https://docs.litellm.ai)
- [Ollama Claude Code Support](https://docs.ollama.com/integrations/claude-code)
- [Z.AI GLM API](https://docs.z.ai)
- [Kimi K2 API](https://platform.moonshot.ai/docs/guide/agent-support)

