-- Create OTP verification table for email verification
-- Run this SQL in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS otp_verifications (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  application_id VARCHAR(50) NOT NULL,
  otp VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  verified BOOLEAN DEFAULT FALSE,
  
  -- Index for faster lookups
  UNIQUE(email, application_id)
);

-- Create index for cleanup of expired OTPs
CREATE INDEX IF NOT EXISTS idx_otp_expires_at ON otp_verifications(expires_at);

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_verifications(email);

-- Optional: Function to auto-delete expired OTPs (runs periodically)
-- This keeps your table clean
CREATE OR REPLACE FUNCTION delete_expired_otps()
RETURNS void AS $$
BEGIN
  DELETE FROM otp_verifications 
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a scheduled job to clean up expired OTPs every hour
-- Note: You may need to set this up in Supabase dashboard under Database > Cron Jobs
-- SELECT cron.schedule('cleanup-expired-otps', '0 * * * *', 'SELECT delete_expired_otps();');

COMMENT ON TABLE otp_verifications IS 'Stores OTPs for email verification during admission application process';
COMMENT ON COLUMN otp_verifications.expires_at IS 'OTP expiration timestamp (10 minutes from creation)';
COMMENT ON COLUMN otp_verifications.verified IS 'Whether this OTP has been successfully verified';
