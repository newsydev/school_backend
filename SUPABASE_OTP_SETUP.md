# Supabase OTP Storage Setup Guide

## ✅ **What Changed**

Your OTP storage has been **upgraded from in-memory to Supabase database** for production reliability!

**Benefits:**
- ✅ OTPs persist across server restarts
- ✅ Works with multiple server instances
- ✅ Database-level data integrity
- ✅ Auto-cleanup of expired OTPs
- ✅ Audit trail of OTP usage

---

## 🔧 **Setup Required (One-Time)**

### Step 1: Create the Supabase Table

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy and paste the contents of `supabase-otp-table.sql`
6. Click **RUN** to execute the SQL

**The SQL creates:**
- `otp_verifications` table with proper schema
- Indexes for fast lookups
- Unique constraint on (email, application_id)
- Auto-cleanup function for expired OTPs

---

## 📊 **Table Schema**

```sql
otp_verifications
├── id               BIGSERIAL PRIMARY KEY
├── email            VARCHAR(255) NOT NULL
├── application_id   VARCHAR(50) NOT NULL
├── otp              VARCHAR(6) NOT NULL
├── expires_at       TIMESTAMP WITH TIME ZONE NOT NULL
├── created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
├── verified         BOOLEAN DEFAULT FALSE
└── UNIQUE(email, application_id)
```

---

## 🔄 **How It Works Now**

### **Sending OTP:**

```
User clicks "Get OTP"
  → Backend generates 6-digit OTP
  → **Stores in Supabase otp_verifications table**
  → Sends email via Brevo
  → User receives email
```

### **Verifying OTP:**

```
User enters OTP
  → Backend queries Supabase for matching record
  → Checks if expired (10 minutes)
  → Checks if already verified
  → Validates OTP matches
  → **Marks as verified** in database
  → Returns success
```

---

## 📝 **Code Changes Summary**

### **email-service.js:**
- ✅ Added Supabase client import
- ✅ Replaced `Map()` with Supabase queries
- ✅ `storeOTP()` now `async` - inserts to database
- ✅ `verifyOTP()` now `async` - queries database
- ✅ Uses `upsert` to handle duplicate requests

### **index.js:**
- ✅ Added `await` to `storeOTP()` call
- ✅ Added `await` to `verifyOTP()` call

### **No Frontend Changes:**
- ✅ Frontend code unchanged
- ✅ API contract remains the same

---

## 🧪 **Testing**

After creating the table, test the flow:

1. **Restart backend server:**
   ```bash
   # Stop the current server (Ctrl+C)
   npm run dev
   ```

2. **Test from frontend:**
   - Go to admission form
   - Enter email and click "Get OTP"
   - Check your email for OTP
   - Enter OTP and verify
   - Should work exactly as before!

3. **Verify in Supabase:**
   - Go to Supabase → Table Editor
   - Open `otp_verifications` table
   - You should see OTP records stored there

---

## 🔍 **Database Queries You Can Run**

### View all OTPs:
```sql
SELECT * FROM otp_verifications
ORDER BY created_at DESC;
```

### View only unverified OTPs:
```sql
SELECT * FROM otp_verifications
WHERE verified = false
ORDER BY created_at DESC;
```

### View expired OTPs:
```sql
SELECT * FROM otp_verifications
WHERE expires_at < NOW()
ORDER BY created_at DESC;
```

### Manually delete expired OTPs:
```sql
DELETE FROM otp_verifications
WHERE expires_at < NOW();
```

### Count OTPs by status:
```sql
SELECT 
  verified,
  COUNT(*) as count,
  COUNT(CASE WHEN expires_at < NOW() THEN 1 END) as expired_count
FROM otp_verifications
GROUP BY verified;
```

---

## 🔐 **Security Features**

1. **10-minute expiration** - OTPs auto-expire
2. **One-time use** - Marked as verified after use
3. **Upsert logic** - New OTP replaces old one
4. **Database constraints** - Prevents duplicates
5. **Verified flag** - Prevents OTP reuse

---

## 🧹 **Maintenance (Optional)**

### Auto-Cleanup Expired OTPs

**Option 1: Manual cleanup (when needed):**
```sql
SELECT delete_expired_otps();
```

**Option 2: Scheduled cleanup (recommended):**

Set up a Supabase Edge Function or Database Webhook to run daily:

1. Go to Supabase Dashboard → Database → Cron Jobs
2. Create new cron job:
   - **Name:** `cleanup-expired-otps`
   - **Schedule:** `0 0 * * *` (daily at midnight)
   - **SQL:** `SELECT delete_expired_otps();`

Or keep it simple - expired OTPs are automatically rejected, they just take up minimal space.

---

## ✅ **Ready to Use!**

Once you've created the table in Supabase, your OTP system is **production-ready** with:
- ✅ Database persistence
- ✅ Server restart resilience
- ✅ Multiple server support
- ✅ Audit trail
- ✅ Auto-expiration

No other changes needed - everything else works the same! 🎉
