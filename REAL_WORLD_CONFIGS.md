# Real-World Claude Code Multi-Model Configurations (2026)

Complete, copy-paste-ready configurations for different scenarios.

---

## Config 1: Solo Developer (Cost-Optimized)

**Goal**: Maximum quality at minimum cost ($10/month)

### Setup Script

```bash
#!/bin/bash
# ~/.claude/solo-dev-setup.sh

# Cheap model for quick tasks
export CC_CHEAP_BASE_URL="https://api.z.ai/api/anthropic"
export CC_CHEAP_KEY="sk-z-ai-..."

# Medium model for regular work
export CC_MEDIUM_BASE_URL="https://openrouter.ai/api/v1"
export CC_MEDIUM_KEY="sk-or-v1-..."

# Function to switch models
cc() {
    case "$1" in
        cheap)
            export ANTHROPIC_BASE_URL="$CC_CHEAP_BASE_URL"
            export ANTHROPIC_API_KEY="$CC_CHEAP_KEY"
            echo "💰 Cheap mode (GLM 4.5-air): $0.10/1M"
            ;;
        medium)
            export ANTHROPIC_BASE_URL="$CC_MEDIUM_BASE_URL"
            export ANTHROPIC_API_KEY="$CC_MEDIUM_KEY"
            echo "⚖️  Medium mode (Qwen): $0.20/1M"
            ;;
        *)
            export ANTHROPIC_BASE_URL="$CC_CHEAP_BASE_URL"
            export ANTHROPIC_API_KEY="$CC_CHEAP_KEY"
            echo "💰 Cheap mode (default)"
            ;;
    esac

    # Start Claude Code
    claude
}

# Aliases for quick access
alias cc-cheap="cc cheap"
alias cc-medium="cc medium"

echo "✅ Setup complete!"
echo "Usage: cc-cheap  (for quick tasks)"
echo "       cc-medium (for regular work)"
```

### Environment Setup

Add to `~/.bashrc` or `~/.zshrc`:

```bash
source ~/.claude/solo-dev-setup.sh

# Default to cheap model
cc cheap
```

### Daily Workflow

```bash
# Morning: Regular feature work
cc-medium
# Build feature, refactor, write tests

# Afternoon: Quick fixes and formatting
cc-cheap
# Fix bugs, format code, run linter

# Before commit: Quality review
cc-medium
# Review own code before pushing
```

### Cost Breakdown

```
Daily usage: 50K tokens
- 60% with GLM 4.5-air (30K @ $0.10/1M) = $0.003
- 40% with Qwen (20K @ $0.20/1M) = $0.004
Daily cost: $0.007
Monthly: $0.21 🎉

Even with casual 500K tokens/day: $2/month
```

---

## Config 2: Small Team (5 Developers)

**Goal**: Balance quality and cost with team management

### LiteLLM Docker Compose Setup

```yaml
# docker-compose.yml
version: '3.9'

services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

  litellm:
    image: python:3.11-slim
    working_dir: /app
    command: >
      bash -c "pip install litellm redis &&
               litellm --config /app/config.yaml --port 8000"
    ports:
      - "8000:8000"
    volumes:
      - ./litellm-config.yaml:/app/config.yaml
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
      - LITELLM_MASTER_KEY=${LITELLM_MASTER_KEY}
      - LITELLM_CACHE_TYPE=redis
      - LITELLM_CACHE_HOST=redis
      - LITELLM_CACHE_PORT=6379
    depends_on:
      - redis
    restart: always

volumes:
  redis-data:
```

### LiteLLM Configuration

```yaml
# litellm-config.yaml
model_list:
  # Tier 1: Cheap (formatting, simple fixes)
  - model_name: haiku
    litellm_params:
      model: z-ai/glm-4-5-air
      api_key: ${OPENROUTER_API_KEY}
      base_url: https://openrouter.ai/api/v1

  # Tier 2: Medium (regular features)
  - model_name: sonnet
    litellm_params:
      model: anthropic/claude-3-5-sonnet-20241022
      api_key: ${ANTHROPIC_API_KEY}

  - model_name: sonnet  # Fallback for sonnet
    litellm_params:
      model: openai/gpt-4o
      api_key: ${OPENROUTER_API_KEY}
      base_url: https://openrouter.ai/api/v1

  # Tier 3: Premium (complex tasks)
  - model_name: opus
    litellm_params:
      model: anthropic/claude-opus-4-20250514
      api_key: ${ANTHROPIC_API_KEY}

  - model_name: opus  # Fallback
    litellm_params:
      model: openai/gpt-4-turbo
      api_key: ${OPENROUTER_API_KEY}
      base_url: https://openrouter.ai/api/v1

  # Local fallback
  - model_name: sonnet
    litellm_params:
      model: ollama/neural-chat
      api_base: http://ollama:11434

fallbacks:
  haiku: [sonnet, ollama/neural-chat]
  sonnet: [opus, openai/gpt-4o, ollama/neural-chat]
  opus: [openai/gpt-4-turbo, sonnet]

litellm_settings:
  tpm_limit: 500000         # 500K tokens/minute
  rpm_limit: 5000           # 5000 requests/minute
  enable_caching: true

# Virtual keys for each developer
user_api_key_alias:
  alice-key:
    user_id: alice
    models: [haiku, sonnet, opus]
  bob-key:
    user_id: bob
    models: [haiku, sonnet]
  charlie-key:
    user_id: charlie
    models: [sonnet]

api_keys:
  - sk-litellm-master
```

### Team Setup Script

```bash
#!/bin/bash
# setup-team.sh

# Start Docker Compose
docker-compose up -d

# Create .env file (in .gitignore!)
cat > .env << 'EOF'
ANTHROPIC_API_KEY=sk-ant-...
OPENROUTER_API_KEY=sk-or-v1-...
LITELLM_MASTER_KEY=sk-litellm-master-123
OLLAMA_BASE_URL=http://ollama:11434
EOF

# Configure for each team member
cat > ~/.claude/team-setup.sh << 'EOF'
# Alice: Backend engineer (full access)
export ANTHROPIC_BASE_URL="http://localhost:8000"
export ANTHROPIC_API_KEY="alice-key"

# Bob: Frontend engineer (medium tier)
export ANTHROPIC_BASE_URL="http://localhost:8000"
export ANTHROPIC_API_KEY="bob-key"

# Charlie: Junior developer (cheap tier only)
export ANTHROPIC_BASE_URL="http://localhost:8000"
export ANTHROPIC_API_KEY="charlie-key"
EOF

# Test setup
curl -X GET http://localhost:8000/health
```

### Team Cost Breakdown

```
Monthly per developer:
- Junior (haiku only): $2-5
- Regular (sonnet): $20-30
- Senior (with opus): $50-80

Team of 5:
- 2 juniors: $10
- 2 regulars: $50
- 1 senior: $60
Total: ~$120/month

vs. Claude Pro for all: 5 × $20 = $100/month
But this includes fallbacks, caching, routing! Better value.
```

---

## Config 3: Enterprise (100+ Developers)

**Goal**: Self-hosted, maximum control, enterprise features

### Kubernetes Deployment

```yaml
# claude-code-proxy.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: litellm-config
data:
  config.yaml: |
    model_list:
      - model_name: haiku
        litellm_params:
          model: anthropic/claude-3-5-haiku-20241022
          api_key: ${ANTHROPIC_API_KEY}
      - model_name: sonnet
        litellm_params:
          model: anthropic/claude-3-5-sonnet-20241022
          api_key: ${ANTHROPIC_API_KEY}
      - model_name: opus
        litellm_params:
          model: anthropic/claude-opus-4-20250514
          api_key: ${ANTHROPIC_API_KEY}
      - model_name: sonnet
        litellm_params:
          model: openai/gpt-4o
          api_key: ${OPENROUTER_API_KEY}
          base_url: https://openrouter.ai/api/v1

    fallbacks:
      sonnet: [opus, openai/gpt-4o]
      opus: [openai/gpt-4-turbo]

    litellm_settings:
      tpm_limit: 2000000
      rpm_limit: 20000
      enable_caching: true

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: litellm-proxy
spec:
  replicas: 3
  selector:
    matchLabels:
      app: litellm-proxy
  template:
    metadata:
      labels:
        app: litellm-proxy
    spec:
      containers:
      - name: litellm
        image: python:3.11-slim
        command:
        - bash
        - -c
        - |
          pip install litellm redis
          litellm --config /config/config.yaml --port 8000 --ssl-keyfile /etc/tls/key.pem --ssl-certfile /etc/tls/cert.pem
        ports:
        - containerPort: 8000
        env:
        - name: ANTHROPIC_API_KEY
          valueFrom:
            secretKeyRef:
              name: claude-credentials
              key: api-key
        - name: OPENROUTER_API_KEY
          valueFrom:
            secretKeyRef:
              name: claude-credentials
              key: openrouter-key
        - name: LITELLM_CACHE_HOST
          value: redis-service
        - name: LITELLM_CACHE_PORT
          value: "6379"
        volumeMounts:
        - name: config
          mountPath: /config
        - name: tls
          mountPath: /etc/tls
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
      volumes:
      - name: config
        configMap:
          name: litellm-config
      - name: tls
        secret:
          secretName: litellm-tls

---
apiVersion: v1
kind: Service
metadata:
  name: litellm-service
spec:
  selector:
    app: litellm-proxy
  ports:
  - port: 443
    targetPort: 8000
  type: LoadBalancer

---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis
spec:
  serviceName: redis-service
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        ports:
        - containerPort: 6379
        volumeMounts:
        - name: redis-data
          mountPath: /data
  volumeClaimTemplates:
  - metadata:
      name: redis-data
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 10Gi
```

### Enterprise Configuration

```yaml
# enterprise-config.yaml (more advanced)
model_list:
  # By department
  - model_name: backend-haiku
    litellm_params:
      model: anthropic/claude-3-5-haiku-20241022
      api_key: ${BACKEND_ANTHROPIC_KEY}

  - model_name: frontend-sonnet
    litellm_params:
      model: anthropic/claude-3-5-sonnet-20241022
      api_key: ${FRONTEND_ANTHROPIC_KEY}

  - model_name: ai-team-opus
    litellm_params:
      model: anthropic/claude-opus-4-20250514
      api_key: ${AI_TEAM_ANTHROPIC_KEY}

router_settings:
  strategy: cost-aware
  weight_by_cost: true
  max_retries: 5

# Monitoring & logging
litellm_settings:
  enable_logging: true
  logging_database_name: claude-metrics
  audit_logging: true

# Rate limiting per department
team_limits:
  backend:
    tpm: 1000000
    rpm: 10000
  frontend:
    tpm: 500000
    rpm: 5000
  ai-team:
    tpm: 2000000  # Unlimited essentially
    rpm: 20000

# Cost tracking
cost_tracking:
  enabled: true
  budget_per_team:
    backend: 500    # $500/month budget
    frontend: 300
    ai-team: 2000
  alert_at_percent: 80  # Alert at 80% of budget
```

### Cost Management Dashboard

```python
# dashboard.py - Flask app for monitoring
from flask import Flask, jsonify
import redis

app = Flask(__name__)
redis_client = redis.Redis(host='localhost', port=6379)

@app.route('/analytics')
def analytics():
    return jsonify({
        'total_requests': redis_client.get('total_requests'),
        'total_tokens': redis_client.get('total_tokens'),
        'total_cost': redis_client.get('total_cost'),
        'by_team': {
            'backend': {
                'requests': redis_client.get('backend:requests'),
                'tokens': redis_client.get('backend:tokens'),
                'cost': redis_client.get('backend:cost')
            },
            'frontend': {
                'requests': redis_client.get('frontend:requests'),
                'tokens': redis_client.get('frontend:tokens'),
                'cost': redis_client.get('frontend:cost')
            }
        }
    })

if __name__ == '__main__':
    app.run(port=5000)
```

---

## Config 4: Research Team (GPU-Heavy, Local Models)

**Goal**: Complete privacy, local models, no API calls

### Full Local Setup

```bash
#!/bin/bash
# local-ai-setup.sh

# Install dependencies
curl -fsSL https://ollama.ai/install.sh | sh

# Pull models
echo "📥 Pulling large models (30 mins)..."
ollama pull llama2:70b           # Best for reasoning
ollama pull codellama:34b-python # Best for coding
ollama pull mistral:7b           # Fast fallback

# Install vLLM for better performance (optional)
pip install vllm

# Start Ollama server
ollama serve &

# Wait for server
sleep 5

# Test connectivity
curl http://localhost:11434/api/tags

# Configure Claude Code
export ANTHROPIC_BASE_URL="http://localhost:11434/api"
export ANTHROPIC_API_KEY="ollama"

echo "✅ Local AI setup complete!"
echo "Model availability:"
echo "- Primary: llama2:70b (code reasoning)"
echo "- Secondary: codellama:34b-python"
echo "- Fallback: mistral:7b"
```

### Performance Tuning

```bash
# On GPU machine (NVIDIA)
export CUDA_VISIBLE_DEVICES=0,1,2,3  # Use 4 GPUs

# For llama2:70b (requires 40GB VRAM)
ollama pull llama2:70b
export OLLAMA_NUM_GPU=2  # Use 2 GPUs
ollama serve

# For development (single GPU)
ollama pull codellama:13b-python
export OLLAMA_NUM_GPU=1
ollama serve
```

### Comparison: Local vs Cloud

```
Setup: Local llama2:70b

Hardware cost:
- RTX 4090: $1,600
- Server rental: $500/month
- Amortized over 2 years: ~$1,200 hardware + $12K rental = $13.2K

Usage cost (100K tokens/day):
- Local: $0 (just power)
- Claude API: $100-500/month

Break-even: ~2-3 months
After that: 99% savings!

Good for:
- Long-term projects
- High-security environments
- Cost-sensitive research teams
- Organizations with AI infrastructure
```

---

## Config 5: Production API Service

**Goal**: Use Claude Code as a service for end-users

### FastAPI Wrapper

```python
# api.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import anthropic
import os

app = FastAPI()

class ClaudeCodeRequest(BaseModel):
    prompt: str
    model: str = "claude-sonnet-4"
    max_tokens: int = 4096

@app.post("/v1/chat/completions")
async def chat_completion(request: ClaudeCodeRequest):
    """Proxy endpoint for Claude Code"""

    # Route to appropriate model/provider
    if request.model.startswith("gpt"):
        base_url = "https://openrouter.ai/api/v1"
        api_key = os.getenv("OPENROUTER_API_KEY")
    elif request.model.startswith("glm"):
        base_url = "https://api.z.ai/api/anthropic"
        api_key = os.getenv("Z_AI_API_KEY")
    else:
        base_url = "https://api.anthropic.com"
        api_key = os.getenv("ANTHROPIC_API_KEY")

    try:
        client = anthropic.Anthropic(
            api_key=api_key,
            base_url=base_url
        )

        message = client.messages.create(
            model=request.model,
            max_tokens=request.max_tokens,
            messages=[
                {"role": "user", "content": request.prompt}
            ]
        )

        return {
            "id": message.id,
            "object": "chat.completion",
            "created": message.created_at.timestamp(),
            "model": request.model,
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": message.content[0].text
                },
                "finish_reason": "stop"
            }],
            "usage": {
                "prompt_tokens": message.usage.input_tokens,
                "completion_tokens": message.usage.output_tokens,
                "total_tokens": message.usage.input_tokens + message.usage.output_tokens
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Run with: uvicorn api:app --port 8000
```

### Docker Deployment

```dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY api.py .

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
```

```bash
# Build and run
docker build -t claude-code-api .
docker run -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
           -e OPENROUTER_API_KEY=$OPENROUTER_API_KEY \
           -p 8000:8000 \
           claude-code-api
```

---

## Config 6: Power User (Advanced Routing)

**Goal**: Maximum flexibility with claude-code-router

### Advanced Router Config

```json
{
  "default_model": "claude-sonnet-4",
  "debug": true,

  "providers": {
    "anthropic": {
      "type": "anthropic",
      "apiKey": "${ANTHROPIC_API_KEY}",
      "models": {
        "haiku": "claude-3-5-haiku-20241022",
        "sonnet": "claude-3-5-sonnet-20241022",
        "opus": "claude-opus-4-20250514"
      }
    },
    "openrouter": {
      "type": "openrouter",
      "apiKey": "${OPENROUTER_API_KEY}",
      "models": {
        "qwen-base": "alibaba/qwen3-coder-base",
        "qwen": "alibaba/qwen3-coder-plus",
        "deepseek": "deepseek/deepseek-r1",
        "gpt4": "openai/gpt-4o",
        "mistral": "mistralai/mistral-large"
      }
    },
    "z-ai": {
      "type": "z-ai",
      "apiKey": "${Z_AI_API_KEY}",
      "models": {
        "glm-5": "glm-4-5-air",
        "glm-6": "glm-4-6",
        "glm-7": "glm-4-7-vision"
      }
    },
    "ollama": {
      "type": "ollama",
      "baseURL": "http://localhost:11434",
      "models": {
        "neural": "neural-chat:7b",
        "mistral": "mistral:7b",
        "llama-13": "llama2:13b",
        "llama-70": "llama2:70b"
      }
    }
  },

  "routing_rules": [
    {
      "name": "micro-edits",
      "pattern": "fix|lint|format|style",
      "priority": 1,
      "provider": "z-ai",
      "model": "glm-5",
      "cost_limit": 0.01
    },
    {
      "name": "simple-coding",
      "pattern": "write|implement|generate|simple",
      "priority": 2,
      "provider": "openrouter",
      "model": "qwen-base",
      "fallback_chain": ["ollama/neural"]
    },
    {
      "name": "medium-coding",
      "pattern": "refactor|test|feature|improve",
      "priority": 3,
      "provider": "anthropic",
      "model": "sonnet",
      "fallback_chain": ["openrouter/gpt4", "openrouter/qwen"]
    },
    {
      "name": "complex-coding",
      "pattern": "debug|architect|review|complex",
      "priority": 4,
      "provider": "anthropic",
      "model": "opus",
      "fallback_chain": ["openrouter/gpt4-turbo", "openrouter/deepseek"]
    },
    {
      "name": "reasoning",
      "pattern": "reasoning|think|analyze|explain",
      "priority": 5,
      "provider": "openrouter",
      "model": "deepseek",
      "cost_limit": 0.50
    },
    {
      "name": "fallback-default",
      "pattern": ".*",
      "priority": 100,
      "provider": "anthropic",
      "model": "sonnet"
    }
  ],

  "cost_tracking": {
    "enabled": true,
    "daily_limit": 50,
    "monthly_limit": 1000,
    "warn_at_percent": 80
  },

  "caching": {
    "enabled": true,
    "ttl": 3600,
    "backend": "memory"
  }
}
```

### Usage

```bash
# Start router
claude-code-router start --config advanced-config.json

# View current stats
/router cost       # Show cost tracking
/router rules      # Show active rules
/router stats      # Show performance stats

# Manual overrides
/model anthropic,claude-opus-4         # Use Opus
/model openrouter,alibaba/qwen3-coder  # Use Qwen
/model ollama,llama2:70b                # Use local Llama

# Cost analysis
/cost breakdown    # By model
/cost reset       # Reset counter
```

---

## Summary: Which Config for Your Situation?

| Situation | Recommended Config | Cost |
|-----------|-------------------|------|
| **Solo dev, hobby** | Config 1 (Cheap) | $1-5/mo |
| **Solo dev, professional** | Config 4 (Local) or Config 5 | $0 or $10-50/mo |
| **Small team (5-10)** | Config 2 (LiteLLM) | $50-150/mo |
| **Medium team (10-50)** | Config 3 (Kubernetes) | $200-500/mo |
| **Large team (100+)** | Config 3 (Kubernetes) | $500-2000/mo |
| **Research/privacy** | Config 4 (Local) | $500 hardware |
| **End-user service** | Config 5 (API) | Variable |
| **Power user** | Config 6 (Advanced router) | $20-100/mo |

