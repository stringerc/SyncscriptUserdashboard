# ✅ DEPLOYMENT READY CHECKLIST

**Before you start deploying, verify these items:**

---

## 📦 **FILES READY**

Check these files exist:

```bash
# On your local machine (where code is)
ls -la supabase/functions/server/openclaw-bridge.tsx
ls -la OPENCLAW_PHASE1_SETUP_SCRIPT.sh
ls -la contexts/OpenClawContext.tsx
ls -la utils/openclaw-client.ts

# All should exist
```

---

## 🔑 **CREDENTIALS READY**

Gather these before starting:

- [ ] **SSH Key**: `~/Downloads/test.pem` (for EC2 access)
- [ ] **Supabase Service Role Key**:
  - Get from: https://supabase.com/dashboard/project/kwhnrlzibgfedtxpkbgb/settings/api
  - It's the **service_role** key (long JWT token)
- [ ] **OpenRouter API Key**: `sk-or-v1-REDACTED`
  - Already configured ✅

---

## 🌐 **ACCESS VERIFIED**

Test these connections:

- [ ] **Supabase Dashboard**: Can you log in?
  - https://supabase.com/dashboard/project/kwhnrlzibgfedtxpkbgb

- [ ] **EC2 SSH**: Can you connect?
  ```bash
  ssh -i ~/Downloads/test.pem ubuntu@3.148.233.23
  # Should connect without errors
  ```

- [ ] **GitHub**: Can you push?
  ```bash
  git status
  # Should show your repo
  ```

---

## 🛠️ **TOOLS INSTALLED**

Verify you have:

- [ ] **Git**: `git --version`
- [ ] **SSH**: `ssh -V`
- [ ] **curl**: `curl --version`
- [ ] **Text editor**: nano, vim, or VS Code

---

## 📍 **KNOW WHERE FILES ARE**

- [ ] **Setup script location**: Where is `OPENCLAW_PHASE1_SETUP_SCRIPT.sh`?
  - Most likely: In your SyncScript project root
  
- [ ] **SSH key location**: Where is `test.pem`?
  - Should be: `~/Downloads/test.pem`

---

## ⏱️ **TIME ALLOCATED**

- [ ] You have **2-3 hours** available
- [ ] You're not rushed
- [ ] You can monitor for 30-60 min after deployment

---

## 🎯 **READY TO START?**

If all items above are checked, you're ready to deploy!

**Start with**: `/OPENCLAW_PHASE1_DEPLOYMENT_GUIDE.md`

---

## 🚨 **IF SOMETHING ISN'T READY**

**Missing SSH key?**
- Find it: `find ~ -name "test.pem" 2>/dev/null`

**Can't access Supabase?**
- Reset password or contact support

**Missing service role key?**
- Get it from: Supabase Dashboard → Settings → API → service_role

**Don't have 2-3 hours?**
- Wait until you do - don't rush deployment

---

## 📞 **NEED HELP?**

Before starting, make sure you:
1. ✅ Read `/OPENCLAW_PHASE1_VISUAL_SUMMARY.md` (5 min)
2. ✅ Have all credentials ready
3. ✅ Have time allocated
4. ✅ Have access to all systems

**Then**: Follow `/OPENCLAW_PHASE1_DEPLOYMENT_GUIDE.md` step-by-step

Good luck! 🚀
