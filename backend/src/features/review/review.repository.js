import mongoose from "mongoose"
import { ReviewModel } from "./review.schema.js"
import { ApplicationError } from "../../error-handler/applicationError.js"

class reviewRepository {


    async addReview(data) {
        try {
            const review = new ReviewModel(data)
            const saved = await review.save()
            await this.updateProductRating(data.product)
            return saved

        } catch (error) {
            throw new ApplicationError(error.message, 500);

        }


    }

    // Keeps product.rating ({ average, count }) in step with its reviews,
    // so the shop can sort by "Top rated" and "Most popular".
    async updateProductRating(productId) {
        const [stats] = await ReviewModel.aggregate([
            { $match: { product: new mongoose.Types.ObjectId(productId) } },
            { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } },
        ])
        await mongoose.model("Product").updateOne(
            { _id: productId },
            { $set: { rating: {
                average: Math.round((stats?.average ?? 0) * 10) / 10,
                count: stats?.count ?? 0,
            } } }
        )
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
