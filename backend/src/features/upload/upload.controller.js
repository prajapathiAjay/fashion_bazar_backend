import cloudinary from "../../config/cloudinary.js";

export default class UploadController {

    async uploadFiles(req, res, next) {
        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ success: false, message: "at least one file is required" })
            }

            const folder = req.body.folder || "fashion_bazar"

            // multer keeps each file in memory (file.buffer), stream them to cloudinary in parallel
            const results = await Promise.all(
                req.files.map((file) => new Promise((resolve, reject) => {
                    const stream = cloudinary.uploader.upload_stream(
                        { folder, resource_type: "auto" },
                        (error, result) => (error ? reject(error) : resolve(result))
                    )
                    stream.end(file.buffer)
                }))
            )

            return res.status(201).json({
                success: true,
                message: "files uploaded Successfully",
                data: results.map((result) => ({
                    url: result.secure_url,
                    publicId: result.public_id,
                })),
            })
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }

    getSignature(req, res, next) {
        try {
            const timestamp = Math.round(Date.now() / 1000)
            const folder = req.query.folder || "fashion_bazar"

            const signature = cloudinary.utils.api_sign_request(
                { timestamp, folder },
                process.env.CLOUDINARY_API_SECRET
            )

            return res.status(200).json({
                success: true,
                message: "signature generated Successfully",
                data: {
                    timestamp,
                    signature,
                    folder,
                    apiKey: process.env.CLOUDINARY_API_KEY,
                    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
                },
            })
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }
}
