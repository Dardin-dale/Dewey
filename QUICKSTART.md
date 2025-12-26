# Dewey Quick Start

Get Dewey up and running in 15 minutes!

## 1. Install

```bash
npm install
```

## 2. Get API Keys

### Gemini API (Free)
1. Visit https://aistudio.google.com/apikey
2. Click "Get API Key"
3. Copy the key

### Discord Bot
1. Go to https://discord.com/developers/applications
2. Click "New Application" → Name it "Dewey"
3. Copy **Application ID** and **Public Key** from "General Information"
4. Go to "Bot" → Reset Token → Copy **Bot Token**
5. Go to OAuth2 → URL Generator:
   - Scopes: `bot`, `applications.commands`
   - Permissions: `Send Messages`, `Use Slash Commands`
   - Open the generated URL to add bot to your server
6. In Discord: Settings → Advanced → Enable Developer Mode
7. Right-click your server → Copy Server ID

## 3. Configure

```bash
cp .env.example .env
```

Edit `.env`:
```bash
DISCORD_APP_ID=paste_app_id_here
DISCORD_BOT_PUBLIC_KEY=paste_public_key_here
DISCORD_BOT_SECRET_TOKEN=paste_bot_token_here
DISCORD_SERVER_ID=paste_server_id_here

DEFAULT_LLM_PROVIDER=gemini
GEMINI_API_KEY=paste_gemini_key_here

AWS_REGION=us-west-2
```

## 4. Test Locally

```bash
# Build
npm run build

# Test synopsis generation
npm run cli test-synopsis "1984"

# Test with local server
npm run dev
```

## 5. Deploy to AWS

```bash
# Configure AWS (one-time setup)
aws configure

# Deploy
source .env
npm run deploy

# Copy the output URL
```

## 6. Connect Discord

1. Go to Discord Developer Portal → Your App → General Information
2. Paste the deployment URL in "Interactions Endpoint URL"
3. Click "Save Changes"

## 7. Register Commands

```bash
npm run register-commands
```

## 8. Test in Discord

```
/synopsis title:Dune
/discussion title:1984
/recommend based_on:dystopian sci-fi
/provider status
```

## Done!

### What's Next?

Try these features:
- **Discussion Questions**: `/discussion title:YourBook` - Great for meetings!
- **Batch Synopsis**: `/synopsis-batch titles:Book1, Book2, Book3` - Prepare for polls
- **Recommendations**: `/recommend based_on:1984` - Find similar books (BETA)
- **Customize Prompts**: Edit `.env` to tweak AI responses (see README)

See [SETUP.md](SETUP.md) for detailed documentation.

## Quick Commands Reference

| Command | Description |
|---------|-------------|
| `npm run build` | Build TypeScript |
| `npm run dev` | Run local test server |
| `npm run cli status` | Check configuration |
| `npm run cli test-synopsis "title"` | Test synopsis |
| `npm run cli test-discussion "title"` | Test discussion questions |
| `npm run cli test-recommend "based_on"` | Test recommendations |
| `npm run cli show-prompts` | View prompt templates |
| `npm run deploy` | Deploy to AWS |
| `npm run register-commands` | Register Discord commands |

## Troubleshooting

**Commands don't appear in Discord?**
- Wait a few minutes
- Kick and re-add the bot

**"Application did not respond"?**
- Check AWS CloudWatch Logs
- Verify Interactions URL is correct

**LLM errors?**
- Verify API key is correct
- Check quota/credits
- Try: `/provider set name:gemini`
