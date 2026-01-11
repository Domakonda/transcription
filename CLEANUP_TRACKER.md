# Cleanup Tracker

This file tracks items that may need cleanup or removal in the future.

---

## 📋 Optional Files for Future Cleanup

### **Cross-Platform Scripts (Low Priority)**

If you only develop on Windows and don't need Linux/Mac compatibility:

#### **Files to Consider Removing:**
- [ ] `terraform/create_placeholder_lambda.sh` - Linux/Mac script (you use .bat on Windows)

**Reason to Keep:**
- Good for CI/CD pipelines (usually Linux-based)
- Useful if team members use Mac/Linux
- Doesn't hurt to keep both

**Reason to Remove:**
- You only use Windows (.bat file)
- Reduces file clutter
- One less file to maintain

---

## 📁 Duplicate Directory Structures (Medium Priority)

You currently have **two parallel Lambda structures**:

### **Structure 1: Monolithic (`src/`)**
```
src/
├── config/index.ts
├── types/index.ts
└── handlers/
    ├── dmg-inbound-callrecording-transcription.ts
    ├── dmg-inbound-callrecording-persistence.ts
    └── dmg-inbound-callrecording-retrieval.ts
```

### **Structure 2: Microservices (`application/`)**
```
application/
├── com_library/
│   ├── config/index.ts
│   └── types/index.ts
└── inbound/callrecording/
    ├── dmg-inbound-callrecording-transcription/src/index.ts
    ├── dmg-inbound-callrecording-persistence/src/index.ts
    └── dmg-inbound-callrecording-retrieval/src/index.ts
```

**Current Status:** Both exist with IDENTICAL code, just different import paths

#### **Decision Needed:**

**Option A: Keep `src/` (Monolithic)**
- [ ] Delete `application/` directory
- Simpler structure
- Single build process
- All Lambdas deployed together

**Option B: Keep `application/` (Microservices)**
- [ ] Delete `src/` directory
- Independent Lambda builds
- Better for large teams
- Smaller deployment packages

**Option C: Keep Both (Current State)**
- Useful during transition period
- Requires keeping both in sync
- More maintenance overhead

**Recommendation:** Choose one structure and delete the other after confirming your deployment strategy.

---

## 🗑️ Legacy Files (If Unused)

Check if these are still needed:

- [ ] `template.yaml` - AWS SAM template (only needed for local testing with SAM CLI)
- [ ] `.env.example` - If you use Terraform variables instead

---

## 📝 Documentation Files (Review After Deployment)

After successful deployment, consider consolidating documentation:

**Current Docs:**
- `README.md` (main)
- `ARCHITECTURE.md` (detailed architecture)
- `PROJECT_SUMMARY.md` (overview)
- `DEPLOYMENT.md` (traditional deployment)
- `QUICK_REFERENCE.md` (command reference)
- `PROJECT_COMPLETE.md` (completion status)
- `MONO_REPO_DEPLOYMENT.md` (new mono repo guide)
- `CHANGES_SUMMARY.md` (this session's changes)
- `CLEANUP_TRACKER.md` (this file)

**Potential Consolidation:**
- [ ] Merge `DEPLOYMENT.md` + `MONO_REPO_DEPLOYMENT.md` into single guide?
- [ ] Archive `PROJECT_COMPLETE.md` if no longer needed?
- [ ] Move `CHANGES_SUMMARY.md` to a `docs/changelogs/` folder?

---

## 🧹 When to Clean Up

### **Phase 1: After Infrastructure Deployment**
Once Terraform successfully deploys:
- [ ] Verify `lambda_placeholder.zip` is no longer needed (can regenerate)
- [ ] Delete unused `.sh` file if desired

### **Phase 2: After Application Deployment**
Once real Lambda code is deployed:
- [ ] Choose between `src/` vs `application/` structure
- [ ] Delete the unused structure
- [ ] Update build scripts accordingly

### **Phase 3: After Production Validation**
Once everything works in production:
- [ ] Archive old documentation files
- [ ] Remove `template.yaml` if not using SAM local testing
- [ ] Consolidate documentation

---

## 📊 File Size Summary

**Small Files (OK to keep):**
- `create_placeholder_lambda.sh` - 1 KB
- `create_placeholder_lambda.bat` - 1 KB
- `lambda_placeholder.zip` - 10 KB

**Large Directories (Consider removing ONE):**
- `src/` - ~50 KB of TypeScript
- `application/` - ~50 KB of TypeScript (duplicate)

---

## ✅ Cleanup Commands

### **Remove Linux Script (Windows-only dev):**
```bash
cd terraform
del create_placeholder_lambda.sh
```

### **Remove Monolithic Structure (if using microservices):**
```bash
cd bedrock-data-automation
rmdir /s /q src
```

### **Remove Microservices Structure (if using monolithic):**
```bash
cd bedrock-data-automation
rmdir /s /q application
```

### **Clean Generated Files:**
```bash
# Remove compiled JavaScript
rmdir /s /q dist

# Remove node modules
rmdir /s /q node_modules

# Remove Terraform state (CAREFUL - only if re-initializing)
cd terraform
del .terraform -Recurse -Force  # PowerShell
del terraform.tfstate*
```

---

## 📌 Notes

- **Don't rush cleanup** - Wait until you've validated your deployment strategy
- **Keep backups** - Commit to Git before deleting anything
- **Document decisions** - Update this file with what you decide to keep/remove

---

**Last Updated:** 2026-01-10
**Status:** Tracking for future cleanup