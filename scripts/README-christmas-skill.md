# Christmas Present Finder Skill

A comprehensive 5-step workflow that researches a person deeply and recommends the perfect Christmas present based on their profile, interests, and motivations.

## Overview

This skill uses Claude Agent's built-in tools to:
1. **Research** - Gather comprehensive information about a person from the web
2. **Analyze** - Understand their core motivations and values
3. **Discover** - Find top 5 Christmas present options with direct purchase links
4. **Empathize** - Assume their persona to choose what they'd truly want
5. **Recommend** - Present the best match with clear reasoning

## Skill Details

- **ID**: `aa702cea-10d7-4f4f-bf8c-66156cb588e5`
- **Name**: Christmas Present Finder
- **Steps**: 5
- **Tools Used**: WebSearch, Read, Write, Edit, Bash
- **MCP Connections**: None (uses only built-in tools)
- **Trigger Type**: Manual

## How to Use

### Via API (Orchestrator Mode)

Send a POST request to the webhook with `mode: "orchestrator"`:

```bash
curl -X POST http://localhost:3001/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Find the perfect Christmas present for Elon Musk",
    "mode": "orchestrator",
    "requestId": "christmas-2024-elon"
  }'
```

### Example Prompts

```json
{
  "prompt": "Find the perfect Christmas present for Taylor Swift",
  "mode": "orchestrator"
}
```

```json
{
  "prompt": "Help me find a Christmas gift for Bill Gates",
  "mode": "orchestrator"
}
```

```json
{
  "prompt": "I need a Christmas present idea for my colleague who loves AI research - Sarah Hooker",
  "mode": "orchestrator"
}
```

## Workflow Steps

### Step 1: Research & Profile Creation
- **Tools**: WebSearch, Write, Bash
- **Output**: `profile.md` - Comprehensive markdown profile
- **What it does**: Extensively searches the web for information about the person (social media, articles, interviews, etc.) and creates a detailed profile document

### Step 2: Motivation Analysis
- **Tools**: Read, Edit, Write
- **Output**: Updated `profile.md` with "Motivations & Values Analysis" section
- **What it does**: Analyzes the profile to understand core motivations, values, and personality traits

### Step 3: Present Discovery
- **Tools**: Read, WebSearch, Write
- **Output**: `presents.json` - Top 5 gift options with links and match scores
- **What it does**: Searches for actual purchasable products that match the person's profile, including direct URLs, prices, and reasoning

### Step 4: Persona Assumption
- **Tools**: Read, Write
- **Output**: `persona_choice.txt` - First-person internal monologue
- **What it does**: Assumes the person's perspective to determine which gift they would truly want to receive

### Step 5: Final Recommendation
- **Tools**: Read
- **Output**: Clear, formatted recommendation
- **What it does**: Presents the selected gift with purchase link, price, compelling reasoning, and match score

## Expected Response

The workflow will return a comprehensive response like:

```
Selected Present: [Product Name]
Direct Purchase Link: [URL]
Price: $XX.XX

Why This Is Perfect:
[2-3 sentences explaining why this gift perfectly matches the person's
profile, combining both the objective match reasoning and the subjective
persona insights]

Match Score: 95/100
```

## Files Generated

During execution, the workflow creates these files in the working directory:
- `profile.md` - Person's research profile with motivation analysis
- `presents.json` - Top 5 gift options with structured data
- `persona_choice.txt` - First-person perspective on gift preference

These files are automatically cleaned up after the workflow completes.

## Classification

The workflow classifier will match prompts that:
- Mention finding/choosing/selecting a Christmas present or gift
- Reference a specific person by name
- Ask for gift recommendations or suggestions

Example matches:
- ✓ "Find a Christmas present for [Name]"
- ✓ "What should I get [Name] for Christmas?"
- ✓ "Help me choose a gift for [Name]"
- ✓ "Christmas gift ideas for [Name]"

## Notes

- The workflow requires web search access to research the person
- Results quality depends on the person's public online presence
- All gift recommendations include real product links for immediate purchase
- The persona assumption step adds unique psychological insight
- Works best with publicly known individuals (executives, creators, public figures)

## Installation

The skill is already seeded in the database. To re-install or install in a new database:

```bash
# Via SQL
docker-compose exec -T postgres psql -U asyncagent -d async_agent < scripts/seed-christmas-skill.sql

# Or via TypeScript (if dotenv configured)
npx tsx scripts/seed-christmas-skill.ts
```

## Testing

Test the skill with the classifier mode first to verify it's detected:

```bash
curl -X POST http://localhost:3001/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Find a Christmas present for Steve Jobs",
    "mode": "classifier"
  }'
```

Expected classification response:
```json
{
  "classification": {
    "workflowId": "aa702cea-10d7-4f4f-bf8c-66156cb588e5",
    "confidence": "high",
    "reasoning": "Request clearly matches Christmas Present Finder workflow"
  }
}
```
