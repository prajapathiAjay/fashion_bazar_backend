import express from "express"
import multer from "multer";
import UploadController from "./upload.controller.js";
import jwtAuth from "../../middlewares/jwt.middleware.js";
import { isAdmin } from "../../middlewares/IsAdmin.js";

// Uploading puts files in the shop's Cloudinary account, so only admins may do it.
// The login check runs BEFORE multer, so strangers' files are never even read.


const uploadController = new UploadController()
const uploadRouter = express.Router();

// keep file in memory so it goes straight to cloudinary (no local uploads/ folder)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
})


uploadRouter.post("/", jwtAuth, isAdmin, upload.array("files", 5), (req, res, next) => { uploadController.uploadFiles(req, res, next) })
// gives out a signed permission to upload straight to Cloudinary, so it's admin-only too
uploadRouter.get("/signature", jwtAuth, isAdmin, (req, res, next) => { uploadController.getSignature(req, res, next) })


export default uploadRouter
