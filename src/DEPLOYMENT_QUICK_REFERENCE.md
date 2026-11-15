# ⚡ DEPLOYMENT QUICK REFERENCE CARD

**Keep this handy during deployment!**

---

## 🚀 FASTEST DEPLOY (3 Commands)

```bash
vercel login && vercel --prod
supabase login && supabase link --project-ref kwhnrlzibgfedtxpkbgb
supabase functions deploy make-server-57781ad9
```

**Then:** Add env vars in Vercel Dashboard  
**Done!** 🎉

---

## 📚 WHICH GUIDE TO USE?

| Time | Guide | Use When |
|------|-------|----------|
| 5 min | `/DEPLOY_TO_VERCEL.md` | You know what you're doing |
| 20 min | `/VERCEL_DEPLOYMENT_GUIDE.md` | You want step-by-step |
| 30 min | `/DOWNLOAD_AND_DEPLOY_CHECKLIST.md` | You like checkboxes |
| 1 hour | `/PRODUCTION_DEPLOYMENT_COMPLETE.md` | You want everything |

**Not sure?** → `/START_HERE_DEPLOYMENT.md`

---

## 🔐 CRITICAL ENV VARS (Must Have)

```bash
SUPABASE_URL=https://kwhnrlzibgfedtxpkbgb.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=[Supabase Dashboard → Settings → API]
OPENROUTER_API_KEY=sk-or-v1-REDACTED
```

**Full list:** `/.env.example`

---

## ✅ QUICK CHECKS

### Before Deploy
- [ ] `npm install` ✅
- [ ] `npm run build` ✅
- [ ] API keys ready ✅
- [ ] Vercel account ✅

### After Deploy
- [ ] Site loads ✅
- [ ] No console errors ✅
- [ ] Login works ✅
- [ ] Features work ✅

---

## 🆘 QUICK FIXES

**Build fails:**
```bash
npm run type-check
npm run build
```

**App not working:**
→ Check env vars in Vercel Dashboard

**AI not working:**
→ Verify OPENROUTER_API_KEY in both Vercel AND Supabase

---

## 💰 COSTS

**Free (Testing):** $0  
**Production:** $95-245/month (1,000 users)  
**Scale:** $500-2,000/month (10,000+ users)

---

## 📊 EXPECTED PERFORMANCE

- **Lighthouse:** 90+
- **Load Time:** <3s
- **API Response:** <2s
- **AI Response:** <500ms perceived

---

## 🌐 URLS

**After Vercel Deploy:** https://[your-app].vercel.app  
**Custom Domain:** https://syncscript.app  
**Vercel Dashboard:** https://vercel.com/dashboard  
**Supabase Dashboard:** https://supabase.com/dashboard  

---

## 📞 HELP

**Docs:** `/START_HERE_DEPLOYMENT.md`  
**Vercel:** https://vercel.com/support  
**Supabase:** https://supabase.com/support  
**OpenRouter:** https://openrouter.ai/support  

---

## 🎯 SUCCESS = ALL GREEN

✅ Site loads  
✅ No errors  
✅ Login works  
✅ Features work  
✅ Lighthouse 90+  
✅ Mobile works  

---

**Print this. Keep it handy. Deploy with confidence!** 🚀

**Version:** 2.0.0 | **Date:** Feb 10, 2026
