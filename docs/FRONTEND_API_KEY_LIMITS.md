# Frontend UI for API Key Limits

## Overview

The API Key Limits management page provides a web-based interface to configure and manage model access restrictions and monthly quotas for each API key.

## Location

Access the API Key Limits page through the management panel:

```
http://your-server:8080/management.html#api-key-limits
```

Or navigate via the sidebar: **API Key Limits** menu item

## Features

### 1. View All Limits

The main page displays a table with all configured API key limits showing:
- **API Key**: The API key that has restrictions
- **Allowed Models**: List of models this key can access (shows "All Models" if unrestricted)
- **Monthly Quotas**: Request limits per model per month (shows "No Limits" if no quotas)
- **Actions**: Edit and Delete buttons

### 2. Add New Limit

Click the **"Add Limit"** button to configure a new API key limit.

#### Form Fields:

**API Key** (Required)
- The API key to apply restrictions to
- Example: `sk-customer-1`

**Allowed Models** (Optional)
- One model name or pattern per line
- Leave empty to allow all models
- Supports wildcards: `gpt-*`, `claude-*`, etc.
- Example:
  ```
  gpt-4
  claude-sonnet-4
  gpt-3.5-turbo
  ```

**Monthly Quotas** (Optional)
- Click "+ Add Quota" to add model/limit pairs
- **Model**: Name or pattern (supports wildcards)
- **Limit**: Maximum requests per month
- Example:
  - Model: `gpt-4`, Limit: `1000`
  - Model: `claude-*`, Limit: `5000`

### 3. Edit Existing Limit

Click the **"Edit"** button next to any limit to modify:
- Allowed models (add/remove models)
- Monthly quotas (add/remove/adjust limits)

Note: The API key itself cannot be changed (read-only field)

### 4. Delete Limit

Click the **"Delete"** button to remove all restrictions for an API key.
- Confirms before deletion
- After deletion, the API key has unlimited access to all models

## Usage Examples

### Example 1: Restrict to Specific Models

1. Click "Add Limit"
2. Enter API Key: `sk-dev-team`
3. Enter Allowed Models (one per line):
   ```
   gpt-3.5-turbo
   claude-haiku-3
   ```
4. Leave Monthly Quotas empty (no limits)
5. Click Submit

Result: `sk-dev-team` can only use GPT-3.5 Turbo and Claude Haiku 3

### Example 2: Set Monthly Quotas

1. Click "Add Limit"
2. Enter API Key: `sk-customer-basic`
3. Leave Allowed Models empty (all models)
4. Add Monthly Quotas:
   - Model: `gpt-4`, Limit: `1000`
   - Model: `gpt-3.5-turbo`, Limit: `10000`
5. Click Submit

Result: `sk-customer-basic` can use any model but limited to 1,000 GPT-4 requests and 10,000 GPT-3.5 requests per month

### Example 3: Wildcards for Multiple Models

1. Click "Add Limit"
2. Enter API Key: `sk-enterprise`
3. Enter Allowed Models:
   ```
   gpt-*
   claude-opus-*
   ```
4. Add Monthly Quotas:
   - Model: `gpt-4*`, Limit: `5000`
   - Model: `claude-*`, Limit: `10000`
5. Click Submit

Result: `sk-enterprise` can access all GPT models and Claude Opus models, with 5,000 requests/month for GPT-4 variants and 10,000 for all Claude models

### Example 4: Unlimited Access

Simply don't add the API key to the limits list. Any API key not configured in the limits has full unrestricted access.

## Wildcard Patterns

Wildcards allow you to match multiple model names with a single pattern:

- `*` - Matches any sequence of characters
- `gpt-*` - Matches `gpt-4`, `gpt-3.5-turbo`, etc.
- `claude-*-4` - Matches `claude-opus-4`, `claude-sonnet-4`, etc.
- `*-turbo` - Matches any model ending with `-turbo`

## Real-time Updates

Changes made through the web UI:
- Take effect immediately (hot reload)
- Are saved to the config.yaml file
- Don't require server restart
- Are reflected across all server instances

## Visual Indicators

**Badges:**
- 🟢 **All Models** - No model restrictions (green)
- 🔵 **No Limits** - No quota restrictions (blue)
- ⚪ **Model Names** - Specific models allowed (gray badges)

**Quota Display:**
- Shows model pattern and limit: `gpt-4: 1000 req/month`
- Multiple quotas listed vertically for readability

## Tips

1. **Start Restrictive**: Begin with limited access and expand as needed
2. **Use Wildcards**: Easier to manage than listing every model
3. **Test First**: Add a test API key with limits before applying to production keys
4. **Monitor Usage**: Check the Usage Stats page to track actual consumption
5. **Unlimited Keys**: Keep at least one admin API key without restrictions

## Error Messages

When limits are reached or violated, users will receive:

**Model Not Allowed:**
```json
{
  "error": {
    "message": "model \"gpt-4\" is not allowed for this API key",
    "type": "permission_error"
  }
}
```

**Quota Exceeded:**
```json
{
  "error": {
    "message": "monthly quota exceeded for model \"gpt-4\" (limit: 1000, current: 1000)",
    "type": "permission_error"
  }
}
```

## Browser Compatibility

Tested and working on:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Security Notes

- Requires management password authentication
- All API calls use Bearer token authorization
- Changes are logged in server logs
- API keys are masked in the UI for security
