import mongoose, { Schema } from "mongoose"

const reviewSchema = new Schema({
    product: { type: Schema.Types.ObjectId, required: true, ref: "Product", required: true },
    user: { type: Schema.Types.ObjectId, required: true, ref: "User", required: true },
    rating: { type: Number, required: true },
    title: { type: String, required: true },
    comment: { type: String, required: true },
    helpful: { type: Number }


}, { timestamps: true })

export const ReviewModel = mongoose.model("Review", reviewSchema);
