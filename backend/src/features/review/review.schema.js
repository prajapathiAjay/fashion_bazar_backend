import mongoose, { Schema } from "mongoose"

const reviewSchema = new Schema({
    product: { type: Schema.Types.ObjectId, required: true, ref: "Product", required: true },
    user: { type: Schema.Types.ObjectId, required: true, ref: "User", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    // the headline is optional in the review form
    title: { type: String, trim: true, default: "" },
    comment: { type: String, required: true, trim: true },
    helpful: { type: Number, default: 0 }


}, { timestamps: true })

export const ReviewModel = mongoose.model("Review", reviewSchema);
