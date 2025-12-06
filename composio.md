```markdown
# Alfred - Composio Integration Spec

## 1. Connection Manager (`/connections` command)

TUI for managing user's Composio connected accounts.

### Main View: Connections List

```
🔌 Connections

  ● GitHub                    github          
  ● Slack                     slack           
  ○ Gmail                     gmail           [needs auth]
  ◌ Linear                    linear          [disabled]

  [+ Add new connection]

↑↓ navigate • Enter options • a add new • q back
```

**Status indicators:**
- `●` green = active/authenticated
- `○` yellow = needs authentication  
- `◌` gray = disabled
- `●` red = failed/expired

### Connection Options (on Enter)

```
GitHub - Options

  › Reauthenticate
    Disable
    Show tools
    Delete

Enter select • Esc back
```

**Actions:**
- **Reauthenticate**: Triggers OAuth flow again
- **Disable/Enable**: Toggles connection without deleting
- **Show tools**: Lists available tools for this toolkit
- **Delete**: Removes connection from Composio + local DB

### Add New Connection

Triggered by `a` key or selecting `[+ Add new]`.

```
Add Connection

Search: git▌

  › GitHub              Code hosting and version control
    GitLab              DevOps platform
    Gitea               Self-hosted Git service

↑↓ navigate • Enter select • Esc cancel
```

On Enter:

```
Add GitHub?

This will add GitHub to your connections.
Press Enter to continue, Esc to cancel.
```

On confirm → initiate Composio connection.

### Authentication Flow

**For OAuth:**
```
Authenticating GitHub...

Open this URL to authenticate:
https://accounts.google.com/o/oauth2/...

Press Enter to open in browser, or copy the URL above.

Waiting for authentication... ◐
```

Poll Composio for connection status. On success → return to connections list with new connection shown as active.

**For API Key:**
```
Authenticating Stripe...

Enter your API key:
sk-live-▌

Press Enter to submit, Esc to cancel.
```

Submit to Composio → return to connections list.

### API Calls

| Action | Composio Endpoint |
|--------|-------------------|
| List user connections | `GET /v3/connected_accounts?user_id={userId}` |
| List available toolkits | `GET /v3/toolkits` |
| Initiate connection | `POST /v3/connected_accounts` |
| Check connection status | `GET /v3/connected_accounts/{id}` |
| Delete connection | `DELETE /v3/connected_accounts/{id}` |
| Get toolkit tools | `GET /v3/toolkits/{toolkit}/tools` |

---

## 2. Skill MCP Config Middleware

When a skill is created/updated, automatically generate Composio MCP configs for each step.

### Flow

```
Skill Creation
      │
      ▼
┌─────────────────────────────────────────┐
│  For each step:                         │
│    1. Read step.tools (e.g. ["GITHUB_CREATE_ISSUE", "SLACK_SEND_MESSAGE"])
│    2. Extract required toolkits from tool names
│    3. Get auth config IDs for those toolkits
│    4. Create Composio MCP config with allowed_tools
│    5. Save mcp_config_id to step record
└─────────────────────────────────────────┘
```

### Implementation

```typescript
async function createMcpConfigsForSkill(skill: Skill): Promise<void> {
  for (const step of skill.steps) {
    // Extract toolkits from tool names (GITHUB_CREATE_ISSUE → github)
    const toolkits = extractToolkits(step.tools);
    
    // Get auth config IDs (using Composio managed auth)
    const toolkitConfigs = toolkits.map(toolkit => ({
      toolkit,
      auth_config: getAuthConfigId(toolkit) // or use managed auth
    }));

    // Create MCP config with only this step's tools
    const mcpConfig = await composio.mcp.create({
      name: `skill-${skill.id}-step-${step.order}`,
      toolkits: toolkitConfigs,
      allowed_tools: step.tools
    });

    // Save to DB
    await db.skillStep.update({
      where: { id: step.id },
      data: { mcpConfigId: mcpConfig.id }
    });
  }
}
```

### Tool → Toolkit Mapping

Tool names follow pattern: `{TOOLKIT}_{ACTION}`

```
GITHUB_CREATE_ISSUE     → github
SLACK_SEND_MESSAGE      → slack
GMAIL_FETCH_EMAILS      → gmail
GOOGLECALENDAR_LIST     → googlecalendar
```

```typescript
function extractToolkits(tools: string[]): string[] {
  const toolkits = new Set<string>();
  for (const tool of tools) {
    const toolkit = tool.split('_')[0].toLowerCase();
    toolkits.add(toolkit);
  }
  return Array.from(toolkits);
}
```

### Lifecycle

| Event | Action |
|-------|--------|
| Skill created | Create MCP configs for all steps |
| Skill updated (tools changed) | Delete old MCP configs, create new ones |
| Skill deleted | Delete all associated MCP configs |
| Step added | Create MCP config for new step |
| Step removed | Delete MCP config for removed step |

### DB Schema Addition

```prisma
model SkillStep {
  id            String   @id
  skillId       String
  order         Int
  prompt        String
  tools         String[]    // ["GITHUB_CREATE_ISSUE", "SLACK_SEND_MESSAGE"]
  mcpConfigId   String?     // Composio MCP config ID (nullable until created)
  // ...
}
```

---

## Notes

- Use Composio's managed OAuth apps for all integrations (no custom auth configs needed for MVP)
- Cache toolkit list locally (refresh daily)
- MCP configs are created per-skill, not per-user. At runtime, call `composio.mcp.generate(user_id, mcp_config_id)` to get user-specific URL
```
