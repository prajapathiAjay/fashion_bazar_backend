import mongoose from "mongoose";

const wishListSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    },
    { timestamps: true }
);

wishListSchema.index({ user: 1, productId: 1 }, { unique: true });

export const WishListModel = mongoose.model("Wishlist", wishListSchema);