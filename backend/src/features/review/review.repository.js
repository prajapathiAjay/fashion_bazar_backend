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
    // Hidden reviews (moderated by the admin) don't count.
    async updateProductRating(productId) {
        const [stats] = await ReviewModel.aggregate([
            { $match: { product: new mongoose.Types.ObjectId(productId), isHidden: { $ne: true } } },
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

    // Reviews of one product for the shop (hidden ones left out)
    async getAllReviews(product){
        try {
            const reviews=await ReviewModel.find({product, isHidden: { $ne: true }})
                .select("-isHidden")
                .populate("user", "firstName lastName")
                .sort({ createdAt: -1 })
                .lean()
            return await this.markVerified(reviews)
        } catch (error) {
            throw new ApplicationError(error.message,500)
        }

    }

    // Adds verifiedPurchase: true when the reviewer has a (not cancelled) order with that product
    async markVerified(reviews) {
        if (reviews.length === 0) return reviews
        // product / user can be null if they were deleted, so keep only real ids
        const ids = (list) => [...new Set(list.map(String))].filter((id) => mongoose.Types.ObjectId.isValid(id))
        const userIds = ids(reviews.map((r) => r.user?._id ?? r.user).filter(Boolean))
        const productIds = ids(reviews.map((r) => r.product?._id ?? r.product).filter(Boolean))
        if (userIds.length === 0 || productIds.length === 0) {
            return reviews.map((r) => ({ ...r, verifiedPurchase: false }))
        }
        const orders = await mongoose.connection.db.collection("orders")
            .find(
                {
                    user: { $in: userIds.map((id) => new mongoose.Types.ObjectId(id)) },
                    "items.product": { $in: productIds.map((id) => new mongoose.Types.ObjectId(id)) },
                    // a cancelled or returned order doesn't count as having bought it
                    status: { $nin: ["Cancelled", "Returned"] },
                },
                { projection: { user: 1, "items.product": 1 } }
            )
            .toArray()
        const bought = new Set()
        for (const o of orders) for (const item of o.items) bought.add(`${o.user}:${item.product}`)
        return reviews.map((r) => ({
            ...r,
            verifiedPurchase: bought.has(`${r.user?._id ?? r.user}:${r.product?._id ?? r.product}`),
        }))
    }

    // ---------- Admin ----------

    // Every review (hidden too), newest first, with product and customer details
    async getAllForAdmin() {
        const reviews = await ReviewModel.find()
            .populate("product", "name images")
            .populate("user", "firstName lastName email")
            .sort({ createdAt: -1 })
            .lean()
        return await this.markVerified(reviews)
    }

    async findForAdmin(id) {
        if (!mongoose.Types.ObjectId.isValid(id)) throw new ApplicationError("Review not found", 404)
        const review = await ReviewModel.findById(id)
        if (!review) throw new ApplicationError("Review not found", 404)
        return review
    }

    // changes = { isHidden?: boolean, reply?: string }  (reply "" removes the store's answer)
    async moderate(id, changes = {}) {
        const review = await this.findForAdmin(id)
        const ratingAffected = "isHidden" in changes && Boolean(changes.isHidden) !== review.isHidden

        if ("isHidden" in changes) review.isHidden = Boolean(changes.isHidden)
        if ("reply" in changes) {
            const text = typeof changes.reply === "string" ? changes.reply.trim() : ""
            if (text.length > 1000) throw new ApplicationError("Reply can be at most 1000 characters", 400)
            review.reply = text ? { text, repliedAt: new Date() } : undefined
        }
        await review.save()
        if (ratingAffected) await this.updateProductRating(review.product)

        // send back the same shape as the admin list
        const [full] = await this.markVerified([
            await ReviewModel.findById(review._id)
                .populate("product", "name images")
                .populate("user", "firstName lastName email")
                .lean(),
        ])
        return full
    }

    async removeForAdmin(id) {
        const review = await this.findForAdmin(id)
        await review.deleteOne()
        await this.updateProductRating(review.product)
        return review
    }
}
export default reviewRepository
