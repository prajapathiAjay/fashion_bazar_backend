import mongoose from "mongoose"
import reviewRepository from "./review.repository.js"



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


}

export default reviewController