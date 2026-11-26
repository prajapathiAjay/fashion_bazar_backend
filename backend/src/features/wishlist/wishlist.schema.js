import mongoose from "mongoose";

const wishListSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    },
    { timestamps: true }
);

// one save per shopper per product (the old index used a field called "user" that does not exist,
// so it blocked a product for EVERY other shopper once someone had saved it)
wishListSchema.index({ userId: 1, productId: 1 }, { unique: true });

export const WishListModel = mongoose.model("Wishlist", wishListSchema);

// Drop the old broken index and build the right one (runs once the database is connected)
WishListModel.syncIndexes().catch((err) => console.log("Wishlist index sync failed:", err.message));