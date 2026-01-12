# Brevo Email Integration - Setup Guide

This guide provides step-by-step instructions to complete the Brevo email integration for your school admission system.

## ✅ Completed Steps

The following has been implemented:

1. **Brevo SDK Installation** - `@sendinblue/client` package installed
2. **Email Service Module** - `email-service.js` created with:
   - OTP generation and verification
   - In-memory OTP storage with 10-minute expiration
   - HTML email templates for verification and notifications
   - Brevo API integration

3. **API Endpoints** - Three endpoints added to `index.js`:
   - `POST /api/v1/admissions/send-otp` - Sends OTP to user's email
   - `POST /api/v1/admissions/verify-otp` - Verifies OTP entered by user
   - Updated `PUT /api/v1/admin/admissions/:id/review` - Sends email on status change

---

## 📋 Required: Brevo Account Setup

### Step 1: Create Brevo Account

1. Go to https://www.brevo.com/
2. Sign up for a free account
3. Complete email verification

### Step 2: Get API Key

1. Login to Brevo dashboard
2. Navigate to: **Settings** → **SMTP & API** → **API Keys**
3. Click **Generate a new API key**
4. Give it a name (e.g., "School Admissions")
5. Copy the API key (you won't be able to see it again!)

### Step 3: Verify Sender Email

1. Go to **Settings** → **Senders & IP**
2. Click **Add a sender**
3. Enter **any email address you have access to** (Gmail, Yahoo, Outlook, etc.)
   - Example: `yourname@gmail.com` or `school.admissions.2026@gmail.com`
4. Click the verification link sent to your inbox

> [!NOTE]
> You don't need a `@vinayakintercollege.in` email! Any email works (Gmail, Yahoo, etc.). The sender name will still show "Vinayak Inter College Admissions" to recipients.

> [!IMPORTANT]
> You MUST verify your sender email before Brevo will send any emails.

---

## ⚙️ Configuration

### Update `.env` File

Add the following lines to `backend/.env`:

```env
# Brevo Email Configuration
BREVO_API_KEY=your_brevo_api_key_here
SENDER_EMAIL=yourname@gmail.com
SENDER_NAME=Vinayak Inter College Admissions
```

**Replace:**
- `your_brevo_api_key_here` with your actual Brevo API key from Step 2
- `yourname@gmail.com` with the email you verified in Step 3 (can be Gmail, Yahoo, Outlook, etc.)
- `Vinayak Inter College Admissions` with your preferred sender name

> [!TIP]
> **Tip:** Even if you use a Gmail address for SENDER_EMAIL, recipients will see the SENDER_NAME ("Vinayak Inter College Admissions") prominently displayed. The email address is usually shown in smaller text.

---

## 🚀 Testing the Implementation

### Test 1: Start Backend Server

```bash
cd backend
npm run dev
```

You should see: `Admissions backend listening on 4000`

### Test 2: Send OTP Email

Use curl or Postman to test:

```bash
curl -X POST http://localhost:4000/api/v1/admissions/send-otp \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"your-email@example.com\",\"applicationId\":\"ADM2026-123456\"}"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully"
}
```

**Check your email inbox** (and spam folder) for the OTP email.

### Test 3: Verify OTP

Replace `123456` with the OTP from your email:

```bash
curl -X POST http://localhost:4000/api/v1/admissions/verify-otp \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"your-email@example.com\",\"applicationId\":\"ADM2026-123456\",\"otp\":\"123456\"}"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "OTP verified successfully"
}
```

### Test 4: Frontend Integration Test

1. Start the frontend:
   ```bash
   cd schoolpage
   npm run dev
   ```

2. Navigate to the admission form
3. Enter your email address
4. Click "Get OTP" button
5. Check your email for the OTP
6. Enter the OTP and click "Verify OTP"
7. You should see "✓ Email verified successfully!"

### Test 5: Admin Approval Email

1. Login to admin dashboard
2. Select an application
3. Change status to "approved" or "rejected"
4. Add remarks (optional)
5. Save changes
6. Check the applicant's email for the status notification

---

## 📧 Email Templates

### OTP Verification Email

The email includes:
- Welcome message with school branding
- 6-digit OTP in large, clear format
- Expiration time (10 minutes)
- Next steps instructions
- Application ID for reference

### Admin Status Email

The email includes:
- Approval/rejection status with color coding
- Application ID
- Admin remarks (if provided)
- Next steps based on status
- Contact information

---

## 🔧 Troubleshooting

### Email Not Received

1. **Check spam folder** - Brevo emails may be filtered
2. **Verify sender email** - Must be verified in Brevo dashboard
3. **Check API key** - Ensure it's correctly copied to `.env`
4. **Check console logs** - Backend shows detailed error messages
5. **Brevo quota** - Free tier has 300 emails/day limit

### "Failed to send email" Error

1. **Check `.env` file** - Ensure all values are set correctly
2. **Restart backend** - After updating `.env`, restart the server
3. **Check Brevo account** - Ensure account is active and verified
4. **Check API key permissions** - Ensure it has email sending permissions

### OTP Expired or Invalid

- OTPs expire after 10 minutes
- Each email/applicationId combination gets a unique OTP
- Request a new OTP if expired
- OTP is case-sensitive (all numbers)

### Server Restart Loses OTPs

- OTPs are stored in memory (not database)
- Server restart clears all stored OTPs
- Users must request new OTP after server restart
- For production, consider using Redis or database storage

---

## 🎯 Next Steps (Optional Improvements)

1. **Use Redis for OTP Storage** - For better reliability across server restarts
2. **Add Rate Limiting** - Prevent OTP spam by limiting requests per email
3. **Customize Email Templates** - Add school logo and custom branding
4. **Add Resend OTP Feature** - Allow users to request new OTP before expiration
5. **Email Analytics** - Track email open rates and click rates in Brevo dashboard
6. **Add SMS OTP** - Brevo also supports SMS for additional verification

---

## 📝 Summary

✅ **What's Working:**
- Email OTP verification before admission form submission
- Welcome email sent with OTP
- Admin approval/rejection email notifications
- Professional HTML email templates

⚠️ **What You Need to Do:**
1. Create Brevo account and get API key
2. Verify sender email in Brevo
3. Update `.env` with Brevo credentials
4. Test the email flows
5. Deploy and monitor

---

## 📚 Additional Resources

- [Brevo Documentation](https://developers.brevo.com/)
- [Brevo Transactional Email Guide](https://help.brevo.com/hc/en-us/articles/360000946299)
- [Email Deliverability Best Practices](https://help.brevo.com/hc/en-us/articles/360000991960)

Need help? Check the console logs in your backend terminal for detailed error messages.
