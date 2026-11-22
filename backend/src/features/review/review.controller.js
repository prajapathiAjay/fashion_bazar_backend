import mongoose from "mongoose"
import reviewRepository from "./review.repository.js"
import { ApplicationError } from "../../error-handler/applicationError.js"



class reviewController {

    constructor() {
        this.reviewRepo = new reviewRepository()
    }

    async addReview(req, res, next) {
        try {
            const { productId, title, comment } = req.body
            const rating = Number(req.body.rating)

            // 400 = the request itself is wrong, so the form can show the message
            if (!mongoose.isValidObjectId(productId)) {
                return res.status(400).json({ success: false, message: "Product not found" })
            }
            if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
                return res.status(400).json({ success: false, message: "Please choose a rating from 1 to 5" })
            }
            if (typeof comment !== "string" || comment.trim().length < 10) {
                return res.status(400).json({ success: false, message: "Your review needs at least 10 characters" })
            }

            const newReview = await this.reviewRepo.addReview({
                product: productId,
                user: req.userID,
                rating,
                title: typeof title === "string" ? title : "",
                comment,
            })
            return res.status(201).json({ success: true, message: "review added Successfully", data: newReview })

        } catch (error) {
            return res.status(500).json({ success: false, message: error.message })
        }


    }
    async getAllReviews(req, res, next) {
         const {Id}=req.params
        try {
            const reviews=await this.reviewRepo.getAllReviews(Id)
            return res.status(200).json({success:true,message:"All Reviews Fetched Successfully",data:reviews})
        } catch (error) {
            return res.status(500).json({success:false,message:error.message})

        }
    }



    // ---------- Admin ----------

    // GET /api/admin/reviews
    async getAllForAdmin(req, res) {
        try {
            const reviews = await this.reviewRepo.getAllForAdmin()
            return res.status(200).json({ success: true, data: reviews })
        } catch (error) {
            console.log(error)
            return res.status(500).json({ success: false, message: "Could not load reviews" })
        }
    }

    // PATCH /api/admin/reviews/:id  body: { isHidden?: boolean, reply?: string }
    async moderate(req, res) {
        try {
            const review = await this.reviewRepo.moderate(req.params.id, req.body ?? {})
            return res.status(200).json({ success: true, message: "Review updated", data: review })
        } catch (error) {
            const status = error instanceof ApplicationError ? error.code : 500
            if (status === 500) console.log(error)
            return res.status(status).json({ success: false, message: status === 500 ? "Could not update the review" : error.message })
        }
    }

    // DELETE /api/admin/reviews/:id
    async removeForAdmin(req, res) {
        try {
            await this.reviewRepo.removeForAdmin(req.params.id)
            return res.status(200).json({ success: true, message: "Review deleted" })
        } catch (error) {
            const status = error instanceof ApplicationError ? error.code : 500
            if (status === 500) console.log(error)
            return res.status(status).json({ success: false, message: status === 500 ? "Could not delete the review" : error.message })
        }
    }
}

export default reviewController