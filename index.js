import express from 'express'
import cors from 'cors'
import multer from 'multer'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { v2 as cloudinary } from 'cloudinary'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'

dotenv.config()

const PORT = process.env.PORT || 4000
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || 'admissions-docs'
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*'
const CLOUDINARY_CLOUD = process.env.CLOUDINARY_CLOUD
const CLOUDINARY_KEY = process.env.CLOUDINARY_KEY
const CLOUDINARY_SECRET = process.env.CLOUDINARY_SECRET

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY in environment')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Configure Cloudinary if credentials are present
if (CLOUDINARY_CLOUD && CLOUDINARY_KEY && CLOUDINARY_SECRET) {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD,
    api_key: CLOUDINARY_KEY,
    api_secret: CLOUDINARY_SECRET,
    secure: true
  })
}

const app = express()
app.use(cors({ origin: FRONTEND_ORIGIN }))

const upload = multer({ storage: multer.memoryStorage() })

function safeFilename(name){
  return name.replace(/[^a-zA-Z0-9_.-]/g, '_')
}

app.get('/', (req, res) => res.send('Admissions backend running'))

// Simple admin auth config
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@school.local'
const ADMIN_ID = process.env.ADMIN_ID || '77075'
const ADMIN_PASS = process.env.ADMIN_PASS || 'password'
const JWT_SECRET = process.env.JWT_SECRET || 'please-change-this-secret'

function requireAdmin(req, res, next){
  // Allow bypassing auth in development for convenience.
  // Set DISABLE_AUTH=true in your local .env to explicitly disable auth,
  // or run with NODE_ENV !== 'production' (default for local dev).
  if (process.env.NODE_ENV !== 'production' || process.env.DISABLE_AUTH === 'true'){
    console.warn('Auth disabled: allowing admin request without token')
    return next()
  }

  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' })
  const token = auth.slice(7)
  try{
    const payload = jwt.verify(token, JWT_SECRET)
    req.user = payload
    return next()
  }catch(e){
    return res.status(401).json({ error: 'Invalid token' })
  }
}

// Admin login — returns JWT
app.post('/api/v1/auth/login', express.json(), (req, res) => {
  const { email, password } = req.body
  // allow login via configured ADMIN_EMAIL or ADMIN_ID
  if ((email === ADMIN_EMAIL || email === ADMIN_ID) && password === ADMIN_PASS){
    const token = jwt.sign({ email, id: ADMIN_ID, role: 'admin' }, JWT_SECRET, { expiresIn: '8h' })
    return res.json({ token })
  }
  return res.status(401).json({ error: 'Invalid credentials' })
})

// Create admission: accepts multipart/form-data with optional files
app.post('/api/v1/admissions', upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'previous_marksheet', maxCount: 1 },
  { name: 'address_proof', maxCount: 1 }
]), async (req, res) => {
  try{
    const fields = req.body || {}

    // Basic normalization
    const record = {
      application_id: fields.application_id || null,
      student_name: fields.student_name || null,
      date_of_birth: fields.dob || null,
      gender: fields.gender || null,
      // store class as string to match your table (varchar)
      class_applied: fields.class_applied || null,
      previous_school: fields.previous_school || null,
      address: fields.address || null,
      father_name: fields.father_name || null,
      mother_name: fields.mother_name || null,
      father_mobile: fields.father_mobile || null,
      mother_mobile: fields.mother_mobile || null,
      email: fields.email || null,
      aadhaar: fields.aadhaar || null,
      category: fields.category || null,
      tracking_otp: fields.otp_for_tracking || null,
      status: fields.status || null,
      payment_status: fields.payment_status || null,
    }

    // Handle file uploads to Supabase Storage
    // Map frontend file input names to DB column names
    const fileFieldMap = {
      photo: 'passport_photo_url',
      previous_marksheet: 'previous_marksheet_url',
      address_proof: 'address_proof_url'
    }
    const fileFields = Object.keys(fileFieldMap)
    for (const fName of fileFields){
      if (req.files && req.files[fName] && req.files[fName][0]){
        const f = req.files[fName][0]
        const filename = `${record.application_id || 'app'}-${Date.now()}-${safeFilename(f.originalname)}`

        // If Cloudinary is configured, upload there and use the secure URL
        if (CLOUDINARY_CLOUD && CLOUDINARY_KEY && CLOUDINARY_SECRET){
          try{
            // convert buffer to data URI and upload (resource_type 'auto' handles images/docs)
            const base64 = f.buffer.toString('base64')
            const dataUri = `data:${f.mimetype};base64,${base64}`
            const uploadOpts = {
              folder: 'admissions',
              public_id: filename.replace(/\.[^/.]+$/, ''),
              resource_type: 'auto'
            }
            const result = await cloudinary.uploader.upload(dataUri, uploadOpts)
            if (result && result.secure_url){
              const dbCol = fileFieldMap[fName]
              record[dbCol] = result.secure_url
            }
          }catch(upErr){
            console.warn('Cloudinary upload error for', fName, upErr)
          }
        } else {
          // Fallback to Supabase storage if Cloudinary not configured
          try{
            const { error: upErr } = await supabase.storage.from(SUPABASE_BUCKET).upload(filename, f.buffer, { contentType: f.mimetype, upsert: false })
            if (upErr){
              console.warn('Supabase upload error for', fName, upErr)
            } else {
              const { data: urlData } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(filename)
              let publicUrl = null
              if (urlData && urlData.publicUrl) publicUrl = urlData.publicUrl
              else if (urlData && urlData.publicURL) publicUrl = urlData.publicURL
              if (publicUrl) {
                const dbCol = fileFieldMap[fName]
                record[dbCol] = publicUrl
              }
            }
          }catch(e){
            console.warn('Storage upload error', e)
          }
        }
      }
    }

    // Insert into Supabase table
    const { data, error } = await supabase.from('admission_applications').insert([record]).select().single()
    if (error){
      console.error('Insert error', error)
      return res.status(500).json({ error: 'db_insert_failed', details: error })
    }

    return res.json({ success: true, application: data })
  }catch(err){
    console.error('Server error', err)
    return res.status(500).json({ error: 'server_error', details: String(err) })
  }
})

// Tracking endpoint: lookup by application_id and otp
app.get('/api/v1/admissions/track', async (req, res) => {
  const { application_id, otp } = req.query
  if (!application_id || !otp) return res.status(400).json({ error: 'missing_params' })
  try{
    // Try common column names for OTP: `otp_for_tracking` and `tracking_otp`.
    let result = await supabase.from('admission_applications').select('*').eq('application_id', application_id).eq('otp_for_tracking', otp).limit(1).single()
    if (result.error) {
      // fallback to alternate column name used elsewhere in code
      result = await supabase.from('admission_applications').select('*').eq('application_id', application_id).eq('tracking_otp', otp).limit(1).single()
    }
    const { data, error } = result || {}
    if (error) return res.status(404).json({ error: 'not_found' })
    return res.json({ application: data })
  }catch(err){
    console.error('Track error', err)
    return res.status(500).json({ error: 'server_error' })
  }
})

// Upload payment screenshot and mark payment_status as completed
app.post('/api/v1/admissions/track/payment', upload.single('payment_screenshot'), async (req, res) => {
  const { application_id, otp } = req.body
  if (!application_id || !otp) return res.status(400).json({ error: 'missing_params' })
  try{
    let screenshotUrl = null
    if (req.file){
      const f = req.file
      const filename = `${application_id}-payment-${Date.now()}-${safeFilename(f.originalname)}`

      if (CLOUDINARY_CLOUD && CLOUDINARY_KEY && CLOUDINARY_SECRET){
        try{
          const base64 = f.buffer.toString('base64')
          const dataUri = `data:${f.mimetype};base64,${base64}`
          const uploadOpts = { folder: 'admissions/payments', public_id: filename.replace(/\.[^/.]+$/, ''), resource_type: 'auto' }
          const result = await cloudinary.uploader.upload(dataUri, uploadOpts)
          if (result && result.secure_url) screenshotUrl = result.secure_url
        }catch(e){
          console.warn('Cloudinary payment upload error', e)
        }
      } else {
        try{
          const { error: upErr } = await supabase.storage.from(SUPABASE_BUCKET).upload(filename, f.buffer, { contentType: f.mimetype, upsert: false })
          if (!upErr){
            const { data: urlData } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(filename)
            if (urlData && (urlData.publicUrl || urlData.publicURL)) screenshotUrl = urlData.publicUrl || urlData.publicURL
          } else {
            console.warn('Supabase upload error for payment screenshot', upErr)
          }
        }catch(e){
          console.warn('Storage upload error', e)
        }
      }
    }

    const updates = { payment_status: 'completed' }
    if (screenshotUrl) updates.payment_screenshot_url = screenshotUrl

    // Try updating by `otp_for_tracking` first, fall back to `tracking_otp` if needed
    let result = await supabase.from('admission_applications').update(updates).eq('application_id', application_id).eq('otp_for_tracking', otp).select().limit(1)
    // If no rows were updated (or an error occurred), try the alternate column name
    if (!result || !result.data || result.data.length === 0) {
      result = await supabase.from('admission_applications').update(updates).eq('application_id', application_id).eq('tracking_otp', otp).select().limit(1)
    }

    const { data, error } = result || {}
    if (error) return res.status(500).json({ error: 'db_update_failed', details: error })

    // Normalize returned updated row
    let application = data
    if (Array.isArray(data)) application = data[0]
    return res.json({ application })
  }catch(err){
    console.error('Payment upload error', err)
    return res.status(500).json({ error: 'server_error', details: String(err) })
  }
})

// Admin: list admissions with optional filters
app.get('/api/v1/admin/admissions', requireAdmin, async (req, res) => {
  const { status, class_applied, q, limit = 100 } = req.query
  try{
    // select only fields needed by the admin dashboard
    let query = supabase.from('admission_applications').select('id,application_id,student_name,father_name,class_applied,status,email')
    if (status) query = query.eq('status', status)
    if (class_applied) query = query.eq('class_applied', Number(class_applied))
    if (q) query = query.or(`student_name.ilike.%${q}%,application_id.ilike.%${q}%`)
    query = query.order('created_at', { ascending: false }).limit(Number(limit))
    const { data, error } = await query
    if (error) return res.status(500).json({ error: 'db_error', details: error })
    return res.json({ admissions: data })
  }catch(err){
    console.error('Admin list error', err)
    return res.status(500).json({ error: 'server_error' })
  }
})

// Admin: get admission by id or application_id
app.get('/api/v1/admin/admissions/:id', requireAdmin, async (req, res) => {
  const { id } = req.params
  try{
    let { data, error } = await supabase.from('admission_applications').select('*').or(`id.eq.${id},application_id.eq.${id}`).limit(1).single()
    if (error) return res.status(404).json({ error: 'not_found' })
    return res.json({ admission: data })
  }catch(err){
    console.error('Admin get error', err)
    return res.status(500).json({ error: 'server_error' })
  }
})

// Admin: review/update admission (status, notes, documentChecks)
app.put('/api/v1/admin/admissions/:id/review', requireAdmin, express.json(), async (req, res) => {
  const { id } = req.params
  const { status, documentChecks = [], remarks = '' } = req.body
  try{
    const updates = { updated_at: new Date().toISOString() }
    if (status) updates.status = status
    if (remarks) updates.remarks = remarks
    // Only include document_checks when it's a non-empty array
    if (Array.isArray(documentChecks) && documentChecks.length > 0) updates.document_checks = documentChecks

    console.log('Admin review:', { id, updates })

    // Helper to run update by id or application_id (do not call .single() because update may return an array)
    async function runUpdate(updatesObj) {
      // First try to update by the primary `id` column. This covers numeric IDs and UUID strings.
      let result = await supabase.from('admission_applications').update(updatesObj).eq('id', id).select()
      // If updating by `id` didn't affect any rows, fall back to `application_id`.
      if (!result || !result.data || result.data.length === 0) {
        result = await supabase.from('admission_applications').update(updatesObj).eq('application_id', id).select()
      }
      return result
    }

    let result = await runUpdate(updates)
    let { data, error } = result || {}

    // If Supabase complains about missing column (schema cache) and we attempted to update document_checks,
    // retry without that key.
    if (error && String(error.message || error).toLowerCase().includes('document_checks')){
      console.warn('Schema error updating document_checks, retrying without that column')
      const updatesNoDoc = { ...updates }
      delete updatesNoDoc.document_checks
      result = await runUpdate(updatesNoDoc)
      ;({ data, error } = result || {})
    }

    if (error) {
      console.error('Supabase update error:', error)
      return res.status(500).json({ error: 'db_update_failed', details: error.message || error })
    }

    // Supabase may return an array of updated rows; normalize to a single admission object.
    let admission = data
    if (Array.isArray(data)){
      if (data.length === 0) {
        return res.status(404).json({ error: 'not_found' })
      }
      if (data.length > 1) console.warn('Update returned multiple rows, returning the first one')
      admission = data[0]
    }

    return res.json({ admission })
  }catch(err){
    console.error('Admin review error', err)
    return res.status(500).json({ error: 'server_error', details: String(err) })
  }
})

app.listen(PORT, () => console.log(`Admissions backend listening on ${PORT}`))

