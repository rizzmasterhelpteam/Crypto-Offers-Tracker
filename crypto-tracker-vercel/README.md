# 🚀 Vercel Deployment Guide

## 📦 What You Have

**Complete Vercel-ready crypto tracker:**
- ✅ Frontend: `index.html` (secure, no exposed API key)
- ✅ Backend: `api/search.js` (serverless function)
- ✅ Config: `vercel.json` (deployment settings)

---

## 🎯 Deploy in 3 Minutes

### Step 1: Push to GitHub

```bash
# Create new repository on GitHub
# Then:

git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/crypto-tracker.git
git push -u origin main
```

### Step 2: Import to Vercel

1. Go to https://vercel.com
2. Sign up/Login (use GitHub)
3. Click "New Project"
4. Import your GitHub repository
5. Click "Deploy"

### Step 3: Add Environment Variable

1. After deployment, go to **Settings**
2. Click **Environment Variables**
3. Add:
   - **Name:** `GROQ_API_KEY`
   - **Value:** `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`
   - **Environment:** Production
4. Click "Save"
5. Go to **Deployments** tab
6. Click ⋯ (three dots) on latest deployment
7. Click "Redeploy"

**Done! 🎉**

Your site is live at: `https://your-project.vercel.app`

---

## 🔒 Security

### ✅ What's Secure:
- API key stored in Vercel environment variables
- NOT visible in frontend code
- Only backend can access it
- Professional setup

### How It Works:
```
User Browser → Vercel Frontend (index.html)
                     ↓
              Calls /api/search
                     ↓
         Vercel Serverless Function
         (Has access to GROQ_API_KEY)
                     ↓
              Calls Groq API
                     ↓
         Returns results to frontend
```

---

## 📁 File Structure

```
crypto-tracker-vercel/
├── index.html           # Frontend (NO API KEY)
├── api/
│   └── search.js       # Serverless function (uses env var)
├── vercel.json         # Vercel config
└── README.md           # This file
```

---

## 🧪 Test Locally

### Option 1: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Create .env file for local testing
echo "GROQ_API_KEY=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" > .env

# Run locally
vercel dev

# Visit: http://localhost:3000
```

### Option 2: Simple HTTP Server

```bash
# Just test frontend (without backend)
python3 -m http.server 8000

# Visit: http://localhost:8000
# Note: Search won't work without backend
```

---

## 🎨 Customize Before Deploying

### Replace AdSense IDs:

Open `index.html` and replace:
```html
ca-pub-XXXXXXXXXX  →  Your Publisher ID
1111111111         →  Top banner slot
2222222222         →  Sidebar slot
3333333333         →  Below header slot
4444444444         →  Mid content slot
5555555555         →  Bottom banner slot
6666666666         →  In-feed slot
```

---

## 🌐 Custom Domain

### Add Your Domain:

1. Go to project **Settings** in Vercel
2. Click **Domains**
3. Add your domain (e.g., `cryptooffers.com`)
4. Follow DNS instructions
5. Wait for DNS propagation (5-30 mins)

**Free SSL included!** 🔒

---

## 📊 Features

### What Works:
- ✅ 22 crypto platforms
- ✅ 5 offer types (airdrops, staking, etc.)
- ✅ AI-powered search via Groq
- ✅ 8-hour client-side caching
- ✅ 6 AdSense ad placements
- ✅ Working platform links
- ✅ Mobile responsive
- ✅ Beautiful UI

### API Endpoints:
- `POST /api/search` - Search crypto offers

---

## 🐛 Troubleshooting

### "API key not configured"

**Fix:**
1. Go to Vercel project settings
2. Environment Variables
3. Make sure `GROQ_API_KEY` is set
4. Redeploy

### "500 Internal Server Error"

**Check:**
1. Vercel function logs (in dashboard)
2. API key is correct
3. Groq API is working

### "No results found"

**Try:**
1. Different platform
2. Different offer type
3. Check browser console for errors

### Frontend loads but search doesn't work

**Fix:**
1. Make sure you redeployed after adding env var
2. Check `/api/search` endpoint directly:
   ```bash
   curl -X POST https://your-site.vercel.app/api/search \
     -H "Content-Type: application/json" \
     -d '{"platform":"Binance","type":"airdrop"}'
   ```

---

## 📈 Performance

### Vercel Benefits:
- ⚡ Global CDN (fast worldwide)
- 🔒 Free SSL certificate
- 🚀 Serverless functions (scales automatically)
- 💰 Free tier (100GB bandwidth/month)
- 🌐 Custom domains
- 📊 Analytics included

### Limits (Free Tier):
- 100GB bandwidth/month
- 100 serverless function executions/day
- More than enough for starting out!

---

## 💰 Cost Estimate

**Vercel: FREE**
- Hosting: Free
- SSL: Free
- Bandwidth: 100GB free
- Functions: 100/day free

**Groq API: FREE**
- 14,400 requests/day free
- Perfect for this app

**Total: $0/month** 🎉

---

## 🚀 Post-Deployment

### 1. Test Everything:
```bash
# Visit your site
https://your-project.vercel.app

# Test search
# Try different platforms
# Check mobile view
```

### 2. Apply for AdSense:
- Add AdSense account
- Replace placeholder IDs
- Wait for approval

### 3. Promote Your Site:
- Share on Twitter
- Post on Reddit (r/CryptoAirdrops)
- Add to crypto directories

### 4. Monitor:
- Vercel Analytics
- Groq API usage
- AdSense revenue

---

## 🎯 Quick Reference

### Deploy:
```bash
vercel --prod
```

### View logs:
```bash
vercel logs
```

### Add env var:
```bash
vercel env add GROQ_API_KEY
```

### Link local to project:
```bash
vercel link
```

---

## 📞 Support

**Vercel Issues:**
- Docs: https://vercel.com/docs
- Support: support@vercel.com

**Groq API Issues:**
- Dashboard: https://console.groq.com
- Docs: https://console.groq.com/docs

**Code Issues:**
- Check browser console (F12)
- Check Vercel function logs
- Test API endpoint directly

---

## ✅ Deployment Checklist

- [ ] Pushed code to GitHub
- [ ] Imported to Vercel
- [ ] Added `GROQ_API_KEY` environment variable
- [ ] Redeployed after adding env var
- [ ] Tested search functionality
- [ ] Replaced AdSense IDs
- [ ] Tested on mobile
- [ ] Added custom domain (optional)
- [ ] Site is live! 🎉

---

## 🎉 You're Done!

Your crypto tracker is now:
- ✅ Deployed on Vercel
- ✅ Secure (API key hidden)
- ✅ Fast (global CDN)
- ✅ Scalable (serverless)
- ✅ Free (no costs)

**Start promoting and earning! 💰**

---

## 💡 Pro Tips

1. **Cache Strategy:** Frontend caches for 8 hours = fewer API calls
2. **Monitor Usage:** Check Groq dashboard daily
3. **SEO:** Add meta tags, sitemap, robots.txt
4. **Analytics:** Enable Vercel Analytics
5. **Content:** Write blog posts about offers

---

**Need help?** Check Vercel logs first, then browser console! 🔍
