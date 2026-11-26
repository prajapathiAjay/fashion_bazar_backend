import mongoose from "mongoose";
import { WishListModel } from "../wishlist/wishlist.schema.js";
import { ApplicationError } from "../../error-handler/applicationError.js";
export default class WishListRepository {

    // Saving the same product twice just returns the existing save (no duplicate error)
    async addToWishList(userId, productId) {
        if (!mongoose.isValidObjectId(productId)) throw new ApplicationError("Valid product ID is required", 400);
        try {
            return await WishListModel.findOneAndUpdate(
                { userId, productId },
                { $setOnInsert: { userId, productId } },
                { upsert: true, new: true }
            );
        } catch (error) {
            console.log(error);
            throw new ApplicationError("Could not save to your wishlist", 500);
        }
    }

    async getWishList(userId) {
        try {
            const wishListItems = await WishListModel.find({ userId }).populate("productId");
            // a deleted product leaves an empty save behind; don't send those
            return wishListItems.filter((item) => item.productId);
        } catch (error) {
            console.log(error);
            throw new ApplicationError("Could not load your wishlist", 500);
        }
    }

    // Only the owner can remove their own save
    async deleteFromWishList(userId, id) {
        if (!mongoose.isValidObjectId(id)) return null;
        try {
            return await WishListModel.findOneAndDelete({ _id: id, userId });
        } catch (error) {
            console.log(error);
            throw new ApplicationError("Could not remove from your wishlist", 500);
        }
    }
}
