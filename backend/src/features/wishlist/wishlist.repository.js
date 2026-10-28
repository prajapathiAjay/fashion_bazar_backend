import { WishListModel } from "../wishlist/wishlist.schema.js";
import { ApplicationError } from "../../error-handler/applicationError.js";
export default class WishListRepository {



    async addToWishList(userId, productId) {
        try {
            const wishListItem = new WishListModel({
                userId: userId,
                productId: productId
            })

            return await wishListItem.save();

        } catch (error) {
            throw new ApplicationError(error, 500);
        }
    }

    async getWishList(userId) {

        try {
            const wishListItems = await WishListModel.find({ userId: userId }).populate("productId");
            return wishListItems;
        } catch (error) {
            throw new ApplicationError(error, 500);

        }

    }

    async deleteFromWishList(id){
        try{
            const deletedItem=await WishListModel.findByIdAndDelete(id);
            return deletedItem;


        }catch(error){
            throw new ApplicationError(error,500);

        }
    }



}