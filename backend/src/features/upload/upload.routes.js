import express from "express"
import multer from "multer";
import UploadController from "./upload.controller.js";


const uploadController = new UploadController()
const uploadRouter = express.Router();

// keep file in memory so it goes straight to cloudinary (no local uploads/ folder)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
})


uploadRouter.post("/", upload.array("files", 5), (req, res, next) => { uploadController.uploadFiles(req, res, next) })
uploadRouter.get("/signature", (req, res, next) => { uploadController.getSignature(req, res, next) })


export default uploadRouter
