import { Router } from 'express'
import auth from '../middleware/auth.js'
import uploadImageController from '../controllers/uploadImage.controller.js'
import upload from '../middleware/multer.js'
import { uploadLimiter } from '../middleware/rateLimitMiddleware.js'

const uploadRouter = Router()

uploadRouter.post("/upload", auth, uploadLimiter, upload.single("image"), uploadImageController)

export default uploadRouter