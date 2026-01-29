# API Key Limits

This feature allows you to control which models each API key can access and set monthly request quotas per model. This is useful for:

- **Multi-tenant deployments**: Give different customers access to different models
- **Cost control**: Limit usage per API key to prevent runaway costs
- **Usage tier management**: Implement different service tiers with different model access and quotas
- **Testing and development**: Provide limited access to development/test API keys

## Configuration

API key limits are configured in the `api-key-limits` section of your `config.yaml`:

```yaml
api-key-limits:
  - api-key: sk-your-api-key
    allowed-models:
      - model-name-1
      - model-name-2
    monthly-quotas:
      model-name-1: 1000
      model-name-2: 5000
```

### Fields

- **`api-key`** (required): The API key these restrictions apply to
- **`allowed-models`** (optional): List of models this API key can access
  - If omitted or empty, all models are allowed
  - Supports wildcard patterns (e.g., `gpt-*`, `claude-*`)
- **`monthly-quotas`** (optional): Map of model names to monthly request limits
  - If omitted or empty, no quota limits are enforced
  - Supports wildcard patterns for model names
  - When a quota is reached, requests are rejected with a 403 Forbidden error

## Examples

### Example 1: Restrict Models Only

Allow an API key to only access specific models:

```yaml
api-key-limits:
  - api-key: sk-customer-basic
    allowed-models:
      - gpt-3.5-turbo
      - claude-haiku-3
```

In this example, `sk-customer-basic` can only use GPT-3.5 Turbo and Claude Haiku 3. Requests for other models will be rejected.

### Example 2: Set Monthly Quotas

Allow all models but limit monthly usage:

```yaml
api-key-limits:
  - api-key: sk-customer-standard
    monthly-quotas:
      gpt-4: 1000
      gpt-3.5-turbo: 10000
      claude-sonnet-4: 2000
```

In this example, `sk-customer-standard` can use any model, but is limited to:
- 1,000 requests/month for GPT-4
- 10,000 requests/month for GPT-3.5 Turbo
- 2,000 requests/month for Claude Sonnet 4

### Example 3: Wildcard Patterns

Use wildcards to match multiple models:

```yaml
api-key-limits:
  - api-key: sk-customer-premium
    allowed-models:
      - gpt-*           # All GPT models
      - claude-opus-*   # All Claude Opus models
    monthly-quotas:
      gpt-4*: 5000      # All GPT-4 variants
      claude-*: 10000   # All Claude models
```

### Example 4: Multiple API Keys

Configure limits for multiple API keys:

```yaml
api-key-limits:
  - api-key: sk-dev-team
    allowed-models:
      - gpt-3.5-turbo
    monthly-quotas:
      gpt-3.5-turbo: 1000

  - api-key: sk-prod-team
    allowed-models:
      - gpt-4
      - claude-sonnet-4
    monthly-quotas:
      gpt-4: 10000
      claude-sonnet-4: 20000

  - api-key: sk-admin
    # No restrictions - full access
```

## Error Responses

### Model Not Allowed

When a request is made for a model that's not in the `allowed-models` list:

```json
{
  "error": {
    "message": "model \"gpt-4\" is not allowed for this API key",
    "type": "permission_error",
    "code": "insufficient_quota"
  }
}
```

HTTP Status: `403 Forbidden`

### Monthly Quota Exceeded

When the monthly quota is exceeded:

```json
{
  "error": {
    "message": "monthly quota exceeded for model \"gpt-4\" (limit: 1000, current: 1000)",
    "type": "permission_error",
    "code": "insufficient_quota"
  }
}
```

HTTP Status: `403 Forbidden`

## Management API

You can manage API key limits through the management API:

### Get All Limits

```bash
GET /v0/management/api-key-limits
```

Response:
```json
{
  "api_key_limits": [
    {
      "api-key": "sk-customer-1",
      "allowed-models": ["gpt-4"],
      "monthly-quotas": {
        "gpt-4": 1000
      }
    }
  ]
}
```

### Replace All Limits

```bash
PUT /v0/management/api-key-limits
Content-Type: application/json

{
  "api_key_limits": [
    {
      "api-key": "sk-customer-1",
      "allowed-models": ["gpt-4", "claude-sonnet-4"],
      "monthly-quotas": {
        "gpt-4": 2000,
        "claude-sonnet-4": 3000
      }
    }
  ]
}
```

### Add or Update a Single Limit

```bash
PATCH /v0/management/api-key-limits
Content-Type: application/json

{
  "api-key": "sk-customer-2",
  "allowed-models": ["gpt-3.5-turbo"],
  "monthly-quotas": {
    "gpt-3.5-turbo": 5000
  }
}
```

### Delete a Limit

```bash
DELETE /v0/management/api-key-limits?api_key=sk-customer-1
```

## Usage Tracking

Monthly usage statistics are tracked per API key per model. The statistics are:

- Stored in `{auth-dir}/usage-statistics.json`
- Automatically persisted every 5 minutes (configurable)
- Reset automatically at the start of each month
- Available through the management API at `/v0/management/usage`

## Wildcard Matching

Model name patterns support standard glob-style wildcards:

- `*` matches any sequence of characters
- `?` matches any single character
- `[abc]` matches any character in the set
- `[a-z]` matches any character in the range

Examples:
- `gpt-*` matches `gpt-4`, `gpt-3.5-turbo`, etc.
- `claude-*-4` matches `claude-opus-4`, `claude-sonnet-4`, etc.
- `gpt-4*` matches `gpt-4`, `gpt-4-turbo`, etc.

## Best Practices

1. **Start restrictive**: Begin with limited access and expand as needed
2. **Use wildcards carefully**: Broad wildcards like `*` match everything
3. **Monitor usage**: Check usage statistics regularly to adjust quotas
4. **Set reasonable quotas**: Consider typical usage patterns when setting limits
5. **Test thoroughly**: Verify limits work as expected before deploying to production
6. **Document your tiers**: Keep track of which API keys belong to which service tiers

## Implementation Details

- **Real-time enforcement**: Limits are checked before processing each request
- **Hot reload**: Configuration changes take effect immediately without restart
- **Thread-safe**: Usage tracking is safe for concurrent requests
- **Efficient**: Minimal performance overhead per request
- **Persistent**: Usage statistics survive server restarts

## Troubleshooting

### Quota not resetting monthly

Usage statistics are stored with timestamps. The quota check looks at requests made in the current calendar month only. If quotas aren't resetting, check:

1. Server system time is correct
2. Usage statistics file isn't corrupted
3. `usage-statistics-enabled` is `true` in config

### API key always rejected

If an API key is always rejected even with proper limits configured:

1. Verify the API key matches exactly (case-sensitive)
2. Check for typos in the configuration
3. Ensure `api-key-limits` section is properly formatted YAML
4. Check server logs for configuration parsing errors

### Wildcards not working

If wildcard patterns aren't matching as expected:

1. Remember that wildcards are case-sensitive
2. Test patterns using standard glob matching rules
3. Use specific patterns before general ones (checked in order)
