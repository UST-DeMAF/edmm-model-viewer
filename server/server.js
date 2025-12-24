/* eslint-disable no-console, node/prefer-global/process */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import cors from 'cors'
import express from 'express'
import multer from 'multer'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const port = process.env.PORT || 3000
const isProduction = process.env.NODE_ENV === 'production'

// Configurable paths via environment variables
// In development, use local .data directory; in production, use /usr/share
const defaultUploadsDir = isProduction
  ? '/usr/share/uploads'
  : path.join(__dirname, '..', '.data', 'uploads')
const defaultTadmsDir = isProduction
  ? '/usr/share/tadms'
  : path.join(__dirname, '..', '.data', 'tadms')

const UPLOADS_DIR = process.env.UPLOADS_DIR || defaultUploadsDir
const TADMS_DIR = process.env.TADMS_DIR || defaultTadmsDir

// Enable CORS for all routes
app.use(cors())

// Parse JSON bodies
app.use(express.json())

// Ensure the destination directory exists
function ensureDirExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

// Initialize directories
ensureDirExists(UPLOADS_DIR)
ensureDirExists(TADMS_DIR)

// Serve static files in production
if (isProduction) {
  const distPath = path.join(__dirname, '..', 'dist')
  app.use(express.static(distPath))
  console.log(`[Static] Serving static files from: ${distPath}`)
}

// Set up multer for file uploads with memory storage
const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB limit per file
  },
})

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// POST endpoint for single file uploads
app.post('/upload', upload.single('file'), (req, res) => {
  const sessionId = req.query.sessionId

  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required.' })
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' })
  }

  try {
    const uploadPath = path.join(UPLOADS_DIR, sessionId, req.file.originalname)
    ensureDirExists(path.dirname(uploadPath))
    fs.writeFileSync(uploadPath, req.file.buffer)

    console.log(`[Upload] Single file saved: ${uploadPath}`)
    res.json({
      message: 'File uploaded successfully.',
      fileName: req.file.originalname,
      sessionId,
    })
  }
  catch (error) {
    console.error('[Upload] Error saving file:', error)
    res.status(500).json({ error: 'Failed to save file.' })
  }
})

// POST endpoint for multiple file uploads, max 1000 files
app.post('/upload-multiple', upload.array('files', 1000), (req, res) => {
  const sessionId = req.query.sessionId

  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required.' })
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded.' })
  }

  try {
    const savedFiles = []

    req.files.forEach((file, index) => {
      const relativePath = req.body.relativePaths?.[index] || file.originalname
      const uploadPath = path.join(UPLOADS_DIR, sessionId, relativePath)
      ensureDirExists(path.dirname(uploadPath))
      fs.writeFileSync(uploadPath, file.buffer)
      savedFiles.push(relativePath)
    })

    console.log(
      `[Upload] Multiple files saved (${req.files.length} files) for session: ${sessionId}`,
    )
    res.json({
      message: 'Files uploaded successfully.',
      filesCount: req.files.length,
      sessionId,
    })
  }
  catch (error) {
    console.error('[Upload] Error saving files:', error)
    res.status(500).json({ error: 'Failed to save files.' })
  }
})

// POST endpoint to move an uploaded file to the TADMs directory
app.post('/move-to-tadms', (req, res) => {
  const { fileName, sessionId, taskId } = req.body

  if (
    !fileName
    || typeof fileName !== 'string'
    || !sessionId
    || typeof sessionId !== 'string'
    || !taskId
    || typeof taskId !== 'string'
  ) {
    return res
      .status(400)
      .json({ error: 'Invalid or missing fileName, sessionId, or taskId.' })
  }

  const sourcePath = path.join(UPLOADS_DIR, sessionId, fileName)
  const destinationPath = path.join(TADMS_DIR, `${taskId}.yaml`)

  try {
    if (!fs.existsSync(sourcePath)) {
      return res.status(404).json({ error: 'Source file not found.' })
    }

    ensureDirExists(TADMS_DIR)
    fs.renameSync(sourcePath, destinationPath)

    console.log(`[Move] File moved: ${sourcePath} -> ${destinationPath}`)
    res.json({ message: 'File moved successfully.', taskId })
  }
  catch (error) {
    console.error('[Move] Error moving file:', error)
    res.status(500).json({ error: 'Failed to move file.' })
  }
})

// POST endpoint to check whether a TADM file exists
app.post('/tadms/exists', (req, res) => {
  const { fileName } = req.body

  if (!fileName || typeof fileName !== 'string') {
    return res.status(400).json({ error: 'Invalid or missing fileName.' })
  }

  const filePath = path.join(TADMS_DIR, fileName)
  const exists = fs.existsSync(filePath)

  res.json({ fileName, exists })
})

// GET endpoint to download a TADM file
app.get('/tadms/:fileName', (req, res) => {
  const { fileName } = req.params
  const filePath = path.join(TADMS_DIR, fileName)

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found.' })
  }

  res.download(filePath, (err) => {
    if (err) {
      console.error('[Download] Error downloading file:', err)
      res.status(500).json({ error: 'Error downloading file.' })
    }
  })
})

// DELETE endpoint to clean up session uploads
app.delete('/uploads/:sessionId', (req, res) => {
  const { sessionId } = req.params
  const sessionPath = path.join(UPLOADS_DIR, sessionId)

  if (!fs.existsSync(sessionPath)) {
    return res.status(404).json({ error: 'Session not found.' })
  }

  try {
    fs.rmSync(sessionPath, { recursive: true, force: true })
    console.log(`[Cleanup] Session removed: ${sessionId}`)
    res.json({ message: 'Session cleaned up successfully.', sessionId })
  }
  catch (error) {
    console.error('[Cleanup] Error removing session:', error)
    res.status(500).json({ error: 'Failed to clean up session.' })
  }
})

// SPA fallback for production - serve index.html for all non-API routes
if (isProduction) {
  app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html')
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath)
    }
    else {
      res.status(404).json({ error: 'Not found' })
    }
  })
}

// Error handling middleware
app.use((err, req, res, _next) => {
  console.error('[Error]', err.stack)
  res.status(500).json({ error: 'Something went wrong!' })
})

app.listen(port, () => {
  console.log(`🚀 EDMM Model Viewer Server is running on port ${port}`)
  console.log(`   Uploads directory: ${UPLOADS_DIR}`)
  console.log(`   TADMs directory: ${TADMS_DIR}`)
})
