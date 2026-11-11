import { ReviewModel } from "./review.schema.js"
import { ApplicationError } from "../../error-handler/applicationError.js"

class reviewRepository {


    async addReview(data) {
        try {
            const review = new ReviewModel(data)
            return await review.save()

        } catch (error) {
            throw new ApplicationError(error.message, 500);

        }


    }

    async getAllReviews(product){
        try {
            const reviews=await ReviewModel.find({product})
                .populate("user", "firstName lastName")
                .sort({ createdAt: -1 })
            return reviews
        } catch (error) {
            throw new ApplicationError(error.message,500)
        }

    }






}
export default reviewRepository
