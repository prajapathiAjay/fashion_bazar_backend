import reviewRepository from "./review.repository.js"



class reviewController {

    constructor() {
        this.reviewRepo = new reviewRepository()
    }

    async addReview(req, res, next) {
        try {
            const { productId, rating, title, comment } = req.body

            const newReview = await this.reviewRepo.addReview({
                product: productId,
                user: req.userID,
                rating,
                title,
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