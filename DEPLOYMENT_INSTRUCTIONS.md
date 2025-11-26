# DEPLOYMENT INSTRUCTIONS - URGENT

## 🚨 Critical Actions Required Before Production

### Step 1: Set Environment Variables in Cloudflare

**Navigate to:** Cloudflare Dashboard → Workers & Pages → techguru-api → Settings → Variables & Secrets

**Add these secrets:**

```bash
ANTHROPIC_API_KEY=<your-anthropic-api-key>
SENDGRID_API_KEY=<your-sendgrid-api-key>
NOTIFICATION_EMAIL=lucas@techguruofficial.us
REPLY_TO_EMAIL=info@techguruofficial.us
ADMIN_EMAIL=lucas@techguruofficial.us
```

### Step 2: Deploy Cloudflare Workers

```bash
cd workers
npx wrangler deploy
```

**Expected output:**
```
✨ Successfully published your worker
🌍 https://techguru-api.lucas-a13.workers.dev
🌍 techguruofficial.us/api/*
```

### Step 3: Test All Endpoints

```bash
# Health check
curl https://techguruofficial.us/api/health

# Should return: {"status":"ok","message":"TechGuru API is running"}
```

**In browser, test:**
1. ✅ Send a chat message
2. ✅ Submit contact form
3. ✅ Subscribe to newsletter
4. ✅ Check email delivery

### Step 4: Monitor Logs

Cloudflare Dashboard → Workers & Pages → techguru-api → Logs (Real-time)

Watch for errors during first few test submissions.

---

## 📋 What Was Fixed

### Issue 1: Chat Widget Logo Oversized
- **Problem:** Logo displayed huge in chat messages
- **Fix:** Added `max-width: 20px; max-height: 20px` to CSS
- **Files:** `css/chat-widget-dark-glass.css` + `.min.css`

### Issue 2: Wrong API Endpoints
- **Problem:** All forms calling `techguru-api.lucas-a13.workers.dev`
- **Fix:** Changed to relative paths `/api/chat`, `/api/contact`, `/api/subscribe`
- **Files:** `js/chat-widget.js`, `js/scripts.js` + `.min.js` versions

---

## ✅ Verification Checklist

Before considering deployment complete:

- [ ] Environment variables set in Cloudflare
- [ ] Workers deployed successfully
- [ ] Health endpoint returns 200 OK
- [ ] Chat widget sends message without errors
- [ ] Contact form submits successfully
- [ ] Newsletter subscription works
- [ ] Confirmation emails received
- [ ] Admin notification emails received
- [ ] No errors in browser console
- [ ] No errors in Cloudflare Workers logs

---

## 🆘 Troubleshooting

### Chat Messages Not Sending
- Check: `ANTHROPIC_API_KEY` is set
- Check: Browser console for errors
- Check: Cloudflare Workers logs

### Emails Not Arriving
- Check: `SENDGRID_API_KEY` is set
- Check: SendGrid dashboard for delivery status
- Check: Spam folder
- Check: Email addresses are correct

### 404 Errors on API Calls
- Check: Workers deployed successfully
- Check: Routes in `wrangler.toml` match domain
- Check: DNS is pointing to Cloudflare

### CORS Errors
- Check: Origin is in allowed list (`workers/src/index.js`)
- Check: Request includes proper headers

---

## 📞 Next Steps After Deployment

1. **Monitor for 24 hours** - Check logs for unexpected errors
2. **Test from multiple devices** - Desktop, mobile, different browsers
3. **Verify email deliverability** - Check spam scores
4. **Set up alerts** - Cloudflare Workers can send error notifications

---

**Last Updated:** November 25, 2025
**Status:** Ready for deployment
