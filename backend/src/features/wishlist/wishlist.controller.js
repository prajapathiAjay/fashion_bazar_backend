import WishListRepository from "./wishlist.repository.js";

export default class WishlistController {
    constructor() {
        this.wishlistRepository = new WishListRepository();
    }


    async addToWishList(req, res, next) {
        const { productId } = req.body;
        const userId = req.userID;


        try {
            const wishListItem = await this.wishlistRepository.addToWishList(userId, productId);
            return res.status(201).json({ success: true, message: "Product added to wishlist", data: wishListItem });

        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }



    }

    async removeFromWishList(req, res, next) {
    const { id } = req.params;
        try {
           const deletedItem=await this.wishlistRepository.deleteFromWishList(id);
           return res.status(200).json({ success: true, message: "Product removed from wishlist", data: deletedItem });


        } catch (error) {

            return res.status(500).json({ success: false, message: error.message });

        }
    }

    async getWishList(req, res, next) {
        const userId = req.userID;
        try {
            const wishListItems=await this.wishlistRepository.getWishList(userId);
            return res.status(200).json({ success: true, message: "Wishlist fetched successfully", data: wishListItems });
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }

    }





}


