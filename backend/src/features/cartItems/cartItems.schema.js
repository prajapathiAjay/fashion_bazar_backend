
import mongoose, { Schema } from "mongoose";

export const cartSchema = new Schema({
    productID: {
        type: mongoose.Schema.Types.ObjectId,
        ref:'Product'
    },
    userID: {
        type: mongoose.Schema.Types.ObjectId,
        ref:'User'
    },
    size:{
        type: String,
        enum: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL']

    },
    quantity:{
        type: Number,
        default: 1
    }
    

}, { timestamps: true })
export const cartModel=mongoose.model('Cart', cartSchema)