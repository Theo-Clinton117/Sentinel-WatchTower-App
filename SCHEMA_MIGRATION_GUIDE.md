# Schema Migration Action Plan

## 🎯 Current Status
- **Code X Schema Alignment**: ✅ PERFECT (no naming fixes needed)
- **Missing Critical Columns**: ⚠️ 2 migrations available
- **Over-Engineered Tables**: ✅ WELL-DESIGNED (keep as-is)

---

## 📌 REQUIRED: Run These Migrations on Supabase

### Migration 006: Notification Tracking
**File**: `db/migrations/006_add_notification_tracking.sql`

Adds delivery and read status tracking:
```sql
ALTER TABLE notifications
ADD COLUMN delivered_at timestamptz,
ADD COLUMN read_at timestamptz;
```

**Impact**: 
- Enables tracking when notifications are delivered to device
- Enables tracking when users read notifications
- No breaking changes - columns are optional

**When Needed**: If you want delivery/read tracking for analytics

---

### Migration 007: Risk Zones Audit Trail
**File**: `db/migrations/007_add_risk_zones_audit_trail.sql`

Adds status and audit tracking:
```sql
ALTER TABLE risk_zones ADD COLUMN 
  status TEXT DEFAULT 'active',
  updated_by UUID REFERENCES users,
  updated_at TIMESTAMPTZ DEFAULT now(),
  resolved_by UUID REFERENCES users,
  resolved_at TIMESTAMPTZ;
```

**Impact**:
- Track who modifies risk zones and when
- Track when zones are resolved
- Enables zone lifecycle audit trail
- No breaking changes

**When Needed**: If you want admin audit trail for zone management

---

## 📚 REFERENCE: Optional Simplifications

**File**: `db/migrations/008_optional_simplifications.sql`

Contains analysis of whether tables should be simplified. **Recommendation**: DO NOT EXECUTE

**Findings**:
- ✅ `reports` + `report_classifications`: Good separation
- ✅ `alerts` + `watch_sessions`: Good normalization  
- ✅ `users` + `user_credibility_profiles`: Good design
- ✅ `latency_metrics`: Already simplified
- ✅ `trusted_contacts` + `user_trust_profiles`: Correct permission design

**Conclusion**: Schema is well-designed. Keep everything as-is.

---

## ✅ MIGRATIONS TO RUN (In Order)

1. **006_add_notification_tracking.sql** (Optional but recommended)
   - Safe: Adds new columns only
   - One-way: No rollback needed
   - Runtime impact: Minimal

2. **007_add_risk_zones_audit_trail.sql** (Recommended)
   - Safe: Adds new columns with defaults
   - Backward compatible: Existing code works unchanged
   - Enables: Future admin audit features

---

## 🔄 CODE UPDATES NEEDED

**Status**: ✅ NONE REQUIRED

Your backend code already uses correct schema:
- ✅ `latency_metrics` queries are correct
- ✅ `trusted_contacts` foreign keys are correct
- ✅ `notifications` columns accessed are all present
- ✅ `risk_zones` columns accessed are all present
- ✅ `admin_audit_logs` structure is correct

---

## 📋 EXECUTION CHECKLIST

- [ ] Review `006_add_notification_tracking.sql`
- [ ] Review `007_add_risk_zones_audit_trail.sql`  
- [ ] Backup Supabase database (Settings → Backups)
- [ ] Run 006 migration in Supabase SQL Editor
- [ ] Run 007 migration in Supabase SQL Editor
- [ ] Verify new columns exist: `SELECT * FROM notifications LIMIT 1;`
- [ ] Verify new columns exist on risk_zones: `SELECT center_lat, center_lng, status, updated_by FROM risk_zones LIMIT 1;`

---

## 🚀 FUTURE ENHANCEMENTS (Optional)

After running migrations 006 & 007, consider adding backend code to:

1. **Notifications Service**
   ```javascript
   // Track delivery
   UPDATE notifications SET delivered_at = now() WHERE id = $1;
   
   // Track read status
   UPDATE notifications SET read_at = now() WHERE id = $1;
   ```

2. **Risk Zones Service**
   ```javascript
   // Track updates
   UPDATE risk_zones 
   SET updated_by = $1, updated_at = now() 
   WHERE id = $2;
   
   // Track resolution
   UPDATE risk_zones 
   SET resolved_by = $1, resolved_at = now() 
   WHERE id = $2;
   ```

---

## Summary
- ✅ Code is already correct
- ✅ Schema is well-designed
- 📌 Run migrations 006 & 007 to add missing tracking columns
- ❌ No table simplifications needed
