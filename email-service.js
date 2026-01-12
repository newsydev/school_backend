import Brevo from '@sendinblue/client'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config()

// Initialize Brevo API client
const client = new Brevo.TransactionalEmailsApi()
const apiKey = client.authentications['apiKey']
apiKey.apiKey = process.env.BREVO_API_KEY

// Initialize Supabase client for OTP storage
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)

// Configuration
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'noreply@example.com'
const SENDER_NAME = process.env.SENDER_NAME || 'Vinayak Inter College Admissions'
const OTP_EXPIRY_MINUTES = 10

/**
 * Generate a 6-digit OTP
 */
export function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * Store OTP with expiration in Supabase
 */
export async function storeOTP(email, applicationId, otp) {
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString()

    try {
        // Use upsert to replace existing OTP if user requests new one
        const { data, error } = await supabase
            .from('otp_verifications')
            .upsert({
                email,
                application_id: applicationId,
                otp,
                expires_at: expiresAt,
                verified: false,
                created_at: new Date().toISOString()
            }, {
                onConflict: 'email,application_id'
            })
            .select()

        if (error) {
            console.error('Error storing OTP:', error)
            throw new Error('Failed to store OTP')
        }

        console.log(`OTP stored in database for ${email}-${applicationId}: ${otp} (expires in ${OTP_EXPIRY_MINUTES} minutes)`)
        return { success: true }
    } catch (err) {
        console.error('Store OTP error:', err)
        throw err
    }
}

/**
 * Verify OTP from Supabase
 */
export async function verifyOTP(email, applicationId, otp) {
    try {
        // Fetch the OTP record
        const { data, error } = await supabase
            .from('otp_verifications')
            .select('*')
            .eq('email', email)
            .eq('application_id', applicationId)
            .eq('verified', false)
            .single()

        if (error || !data) {
            return { valid: false, message: 'OTP not found or already used' }
        }

        // Check if expired
        const expiresAt = new Date(data.expires_at).getTime()
        if (Date.now() > expiresAt) {
            // Delete expired OTP
            await supabase
                .from('otp_verifications')
                .delete()
                .eq('email', email)
                .eq('application_id', applicationId)

            return { valid: false, message: 'OTP has expired' }
        }

        // Check if OTP matches
        if (data.otp !== otp) {
            return { valid: false, message: 'Invalid OTP' }
        }

        // Mark as verified (prevents reuse)
        await supabase
            .from('otp_verifications')
            .update({ verified: true })
            .eq('email', email)
            .eq('application_id', applicationId)

        console.log(`OTP verified successfully for ${email}-${applicationId}`)
        return { valid: true, message: 'OTP verified successfully' }
    } catch (err) {
        console.error('Verify OTP error:', err)
        return { valid: false, message: 'Error verifying OTP' }
    }
}

/**
 * Send OTP verification email with welcome message
 */
export async function sendOTPEmail(recipientEmail, recipientName, applicationId, otp) {
    const sendSmtpEmail = new Brevo.SendSmtpEmail()

    sendSmtpEmail.sender = { name: SENDER_NAME, email: SENDER_EMAIL }
    sendSmtpEmail.to = [{ email: recipientEmail, name: recipientName || 'Applicant' }]
    sendSmtpEmail.subject = `Verify Your Email - Application ${applicationId}`

    sendSmtpEmail.htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f4f4f4;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 30px auto;
          background: #ffffff;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px 20px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
        }
        .content {
          padding: 30px 20px;
        }
        .welcome {
          background: #f8f9ff;
          border-left: 4px solid #667eea;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .otp-box {
          background: #f8f9ff;
          border: 2px dashed #667eea;
          border-radius: 8px;
          padding: 20px;
          text-align: center;
          margin: 25px 0;
        }
        .otp-code {
          font-size: 32px;
          font-weight: bold;
          letter-spacing: 8px;
          color: #667eea;
          margin: 10px 0;
        }
        .info-box {
          background: #fff9e6;
          border-left: 4px solid #ffc107;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .footer {
          background: #f8f9fa;
          padding: 20px;
          text-align: center;
          color: #6c757d;
          font-size: 12px;
        }
        .btn {
          display: inline-block;
          padding: 12px 30px;
          background: #667eea;
          color: white;
          text-decoration: none;
          border-radius: 5px;
          margin: 10px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎓 Welcome to School Admissions</h1>
        </div>
        <div class="content">
          <div class="welcome">
            <h2 style="margin-top: 0; color: #667eea;">Welcome, ${recipientName || 'Dear Applicant'}!</h2>
            <p>Thank you for choosing our school. We're excited to review your application!</p>
          </div>
          
          <p>Your application ID is: <strong>${applicationId}</strong></p>
          
          <p>To complete your application, please verify your email address by entering the OTP below:</p>
          
          <div class="otp-box">
            <p style="margin: 0; color: #666; font-size: 14px;">Your Verification Code</p>
            <div class="otp-code">${otp}</div>
            <p style="margin: 0; color: #666; font-size: 12px;">This code will expire in ${OTP_EXPIRY_MINUTES} minutes</p>
          </div>
          
          <div class="info-box">
            <p style="margin: 0;"><strong>⏰ Important:</strong> Please complete the verification within ${OTP_EXPIRY_MINUTES} minutes. If you didn't request this verification, please ignore this email.</p>
          </div>
          
          <h3 style="color: #667eea;">Next Steps:</h3>
          <ol>
            <li>Enter the OTP in the application form</li>
            <li>Complete all required fields</li>
            <li>Upload necessary documents</li>
            <li>Submit your application</li>
          </ol>
          
          <p style="color: #666; margin-top: 30px;">If you have any questions, please don't hesitate to contact our admissions team.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} School Admissions. All rights reserved.</p>
          <p>This is an automated email. Please do not reply to this message.</p>
        </div>
      </div>
    </body>
    </html>
  `

    try {
        const response = await client.sendTransacEmail(sendSmtpEmail)
        console.log('OTP email sent successfully:', response)
        return { success: true, messageId: response.messageId }
    } catch (error) {
        console.error('Error sending OTP email:', error)
        throw new Error(`Failed to send email: ${error.message}`)
    }
}

/**
 * Send admin approval/rejection notification email
 */
export async function sendAdminStatusEmail(
    recipientEmail,
    recipientName,
    applicationId,
    status,
    remarks = ''
) {
    const sendSmtpEmail = new Brevo.SendSmtpEmail()

    sendSmtpEmail.sender = { name: SENDER_NAME, email: SENDER_EMAIL }
    sendSmtpEmail.to = [{ email: recipientEmail, name: recipientName || 'Applicant' }]

    const isApproved = status.toLowerCase() === 'approved'
    const statusColor = isApproved ? '#10b981' : '#ef4444'
    const statusIcon = isApproved ? '✅' : '❌'
    const statusText = isApproved ? 'Approved' : status.charAt(0).toUpperCase() + status.slice(1)

    sendSmtpEmail.subject = `Application ${statusText} - ${applicationId}`

    sendSmtpEmail.htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          background-color: #f4f4f4;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 30px auto;
          background: #ffffff;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .header {
          background: ${statusColor};
          color: white;
          padding: 30px 20px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
        }
        .content {
          padding: 30px 20px;
        }
        .status-box {
          background: ${isApproved ? '#f0fdf4' : '#fef2f2'};
          border: 2px solid ${statusColor};
          border-radius: 8px;
          padding: 20px;
          text-align: center;
          margin: 25px 0;
        }
        .status-text {
          font-size: 28px;
          font-weight: bold;
          color: ${statusColor};
          margin: 10px 0;
        }
        .info-box {
          background: #f8f9ff;
          border-left: 4px solid #667eea;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .remarks-box {
          background: #fff9e6;
          border-left: 4px solid #ffc107;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .footer {
          background: #f8f9fa;
          padding: 20px;
          text-align: center;
          color: #6c757d;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${statusIcon} Application Status Update</h1>
        </div>
        <div class="content">
          <p>Dear ${recipientName || 'Applicant'},</p>
          
          <p>We have reviewed your admission application and wanted to update you on its status.</p>
          
          <div class="info-box">
            <p style="margin: 0;"><strong>Application ID:</strong> ${applicationId}</p>
          </div>
          
          <div class="status-box">
            <p style="margin: 0; color: #666; font-size: 14px;">Application Status</p>
            <div class="status-text">${statusIcon} ${statusText.toUpperCase()}</div>
          </div>
          
          ${remarks ? `
          <div class="remarks-box">
            <h3 style="margin-top: 0; color: #d97706;">📝 Remarks from Admissions Team:</h3>
            <p style="margin-bottom: 0;">${remarks}</p>
          </div>
          ` : ''}
          
          ${isApproved ? `
          <h3 style="color: #10b981;">🎉 Congratulations!</h3>
          <p>Your application has been approved! Here are the next steps:</p>
          <ol>
            <li>Complete the fee payment process</li>
            <li>Submit any additional required documents</li>
            <li>Attend the orientation session (details will be sent separately)</li>
            <li>Collect your admission confirmation letter</li>
          </ol>
          <p>Our admissions team will contact you shortly with further details.</p>
          ` : `
          <h3 style="color: #ef4444;">Next Steps:</h3>
          <p>If you have any questions regarding your application status, please contact our admissions office.</p>
          <p>You may also consider reapplying in the next admission cycle after addressing any concerns mentioned in the remarks.</p>
          `}
          
          <p style="color: #666; margin-top: 30px;">Thank you for your interest in our school. If you have any questions, please contact our admissions team.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} School Admissions. All rights reserved.</p>
          <p>This is an automated email. Please do not reply to this message.</p>
        </div>
      </div>
    </body>
    </html>
  `

    try {
        const response = await client.sendTransacEmail(sendSmtpEmail)
        console.log('Admin status email sent successfully:', response)
        return { success: true, messageId: response.messageId }
    } catch (error) {
        console.error('Error sending admin status email:', error)
        throw new Error(`Failed to send email: ${error.message}`)
    }
}

// Export all functions
export default {
    generateOTP,
    storeOTP,
    verifyOTP,
    sendOTPEmail,
    sendAdminStatusEmail
}
