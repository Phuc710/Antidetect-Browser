# Client SDKs & CLI Specification

This document specifies the client wrapper libraries and command-line execution interfaces for the API.

---

## 1. REST API Client SDKs

To allow developers to integrate profile launches directly into their automation pipelines, we distribute client SDKs:

### A. TypeScript / Node.js
```typescript
import { MidnightClient } from '@midnight/sdk-node';

const client = new MidnightClient({ apiKey: 'key_123' });
const session = await client.profiles.launch('profile_id');
// Returns playwright-compatible wsEndpoint
const browser = await playwright.chromium.connectOverCDP(session.wsEndpoint);
```

### B. Python
```python
from midnight_sdk import MidnightClient

client = MidnightClient(api_key="key_123")
session = client.profiles.launch("profile_id")
# Session returns debugging URL
print(session.ws_endpoint)
```

### C. Go
```go
import "github.com/midnight/sdk-go"

client := sdk.NewClient("key_123")
session, _ := client.Profiles.Launch("profile_id")
```

---

## 2. Command Line Interface (CLI)

The CLI tool enables scripting profile tasks directly from terminal shell environments:

```bash
# Login to the cloud profile repository
midnight login --api-key=key_123

# List all available browser profiles
midnight profiles list --format=json

# Start a specific profile and print the CDP websocket endpoint
midnight profiles launch [profile_id] --port=9222
```
