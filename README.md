# Options Co-Pilot 🚀

AI-powered options trading assistant. Real-time market scanning powered by Claude + web search. One-tap handoff to IBKR Mobile.

## 🚀 Deploy from your iPad in 30 minutes

### Step 1: Get Anthropic API Key (~3 min)

1. Open Safari → **https://console.anthropic.com**
2. Sign up (free, $5 starter credits)
3. Tap **Settings** → **API Keys** → **Create Key**
4. Copy the key (starts with `sk-ant-...`) — save it somewhere; you'll need it in Step 4

### Step 2: Create GitHub Account & Repo (~5 min)

1. Open Safari → **https://github.com/signup**
2. Sign up with email + password
3. After signup, tap the **+** icon (top right) → **New repository**
4. Name it `options-copilot`
5. Set **Public** (free Vercel deployment requires public repo)
6. Tap **Create repository**

### Step 3: Upload Project Files (~10 min)

The trickiest step on iPad. Two options:

**Option A — Use Working Copy app (recommended)**
1. Install **Working Copy** from App Store (free for basic features)
2. In Working Copy: tap **+** → **Clone repository** → paste your GitHub repo URL
3. Use the **Files** app to drag-drop the project files into the repo folder
4. In Working Copy: tap **Commit** → enter "Initial" → tap **Push**

**Option B — Use GitHub web UI directly**
1. On GitHub.com in Safari, in your empty repo tap **uploading an existing file**
2. Tap **choose your files** and select all the project files (you can do them in batches)
3. Scroll down, tap **Commit changes**

The files you need to upload:
```
options-copilot/
├── app/
│   ├── api/scan/route.js
│   ├── layout.js
│   └── page.js
├── components/
│   └── OptionsCopilot.jsx
├── package.json
├── next.config.js
└── tsconfig.json
```

### Step 4: Deploy on Vercel (~5 min)

1. Open Safari → **https://vercel.com/signup**
2. Tap **Continue with GitHub** → authorize Vercel
3. On the dashboard, tap **Add New** → **Project**
4. Find your `options-copilot` repo → tap **Import**
5. **CRITICAL — Add environment variable:**
   - Expand **Environment Variables**
   - Name: `ANTHROPIC_API_KEY`
   - Value: paste your key from Step 1
   - Tap **Add**
6. Tap **Deploy**
7. Wait ~2 minutes — Vercel will show "Congratulations!" with your URL like `https://options-copilot-xyz.vercel.app`

### Step 5: Add to iPad Home Screen (~30 sec)

1. Open the Vercel URL in Safari on your iPad
2. Tap the **Share** icon (square with up-arrow)
3. Tap **Add to Home Screen** → **Add**
4. Boom — you have a real app icon on your home screen

## 🎯 Daily Use

1. Tap the app icon
2. Tap **⚡ RUN MARKET SCAN** (takes ~30 seconds — Claude searches the web for current market data)
3. Review ideas in **IDEAS** tab
4. Approve good ones → they become trade tickets
5. On a ticket: **COPY DETAILS** → **OPEN IBKR** → place order in IBKR Mobile
6. Tap **LOGGED IN IBKR** to track it

## 💰 Cost

- Vercel hosting: **Free**
- GitHub: **Free**
- Anthropic API: ~**$0.10–0.30 per scan** (web search + Claude Sonnet)
- 100 scans = ~$15

## 🛡 Important Disclaimers

This is a **research tool**, not financial advice. AI-generated ideas reflect Claude's analysis of public data — they can be wrong. Options trading carries substantial risk of total loss. Always:
- Size positions according to your risk tolerance
- Verify the AI's facts before trading
- Use the IBKR paper account first to validate the AI's edge
- Set hard limits in your broker (stop losses, daily loss limits)

## 🔧 Troubleshooting

**"Server missing ANTHROPIC_API_KEY"**
→ Vercel project → Settings → Environment Variables → verify `ANTHROPIC_API_KEY` is set, then **Redeploy**

**"API 401" or "401 Unauthorized"**
→ Your Anthropic key is invalid or out of credits. Check console.anthropic.com → Plans & Billing

**Scan times out**
→ Web search took longer than 60s. Reduce **MAX** to 3, try again.

**Ideas reference outdated prices**
→ The AI uses web search but may pull from articles a few hours old. Always verify current contract prices in IBKR before placing.
