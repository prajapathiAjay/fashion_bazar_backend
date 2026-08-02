
import mongoose from "mongoose";

export const productSchema = new mongoose.Schema({
    name: String,
    price: Number,
    description: String,
    inStock: Number,
    brand: String,
    images: [String],
    discount: Number,
    rating: Number,
    isActive: Boolean,
    reviews: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Review'
        }
    ],
    categories: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Category'
        }
    ]
});