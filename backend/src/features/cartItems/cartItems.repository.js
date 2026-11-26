import { ObjectId } from "mongodb";
import mongoose from "mongoose";
import { ApplicationError } from "../../error-handler/applicationError.js";
import { cartModel } from "./cartItems.schema.js";
import { productSchema } from "../product/product.schema.js";

// Reuse the model if the product repository already registered it
const ProductModel = mongoose.models.Product || mongoose.model("Product", productSchema);

// The product a cart line points to, checked so it can really be bought
async function getBuyableProduct(productID) {
    if (!mongoose.isValidObjectId(productID)) throw new ApplicationError("Valid product ID is required", 400);
    const product = await ProductModel.findById(productID).select("name stock sizes isActive").lean();
    if (!product || product.isActive === false) throw new ApplicationError("This product is no longer available", 404);
    return product;
}

// Sized products need one of THEIR sizes; products without sizes (bags, jewellery) take none
function checkSize(product, size) {
    if (!product.sizes?.length) return undefined;
    if (!size) throw new ApplicationError("Please choose a size", 400);
    if (!product.sizes.includes(size)) throw new ApplicationError(`Size ${size} isn't available for this product`, 400);
    return size;
}

function checkStock(product, quantity) {
    const stock = product.stock ?? 0;
    if (stock <= 0) throw new ApplicationError(`${product.name} is out of stock`, 400);
    if (quantity > stock) throw new ApplicationError(`Only ${stock} left of ${product.name}`, 400);
}

export default class CartItemsRepository {

    constructor() {
        this.collection = "cartItems";
    }

    // One line per product + size. Adding the same product and size again adds to its quantity.
    async add({ productID, userID, quantity, size }) {
        try {
            const product = await getBuyableProduct(productID);
            const lineSize = checkSize(product, size);

            const line = { productID: new ObjectId(productID), userID: new ObjectId(userID), size: lineSize ?? null };
            const existing = await cartModel.findOne(line);
            const newQuantity = (existing?.quantity ?? 0) + quantity;
            checkStock(product, newQuantity);

            if (existing) {
                existing.quantity = newQuantity;
                return await existing.save();
            }
            return await cartModel.create({ ...line, size: lineSize, quantity });
        } catch (err) {
            if (err instanceof ApplicationError) throw err;
            console.log(err);
            throw new ApplicationError("Something went wrong with database", 500);
        }
    }

    async updateCartItem(userID, cartItemId, fields) {
        try {
            if (!mongoose.isValidObjectId(cartItemId)) return null;
            const item = await cartModel.findOne({ _id: new ObjectId(cartItemId), userID: new ObjectId(userID) });
            if (!item) return null;

            const product = await getBuyableProduct(item.productID);
            if (fields.size !== undefined) {
                const size = checkSize(product, fields.size);
                // that size is already its own line -> don't make a duplicate
                const clash = await cartModel.exists({ _id: { $ne: item._id }, userID: item.userID, productID: item.productID, size });
                if (clash) throw new ApplicationError(`Size ${size} is already in your bag`, 400);
                item.size = size;
            }
            if (fields.quantity !== undefined) {
                checkStock(product, fields.quantity);
                item.quantity = fields.quantity;
            }
            return (await item.save()).toObject();
        } catch (err) {
            if (err instanceof ApplicationError) throw err;
            console.log(err);
            throw new ApplicationError("Something went wrong with database", 500);
        }
    }

    async get(userID) {
        try {
            // stock / sizes / isActive let the bag limit quantities and flag items that can't be bought
            return await cartModel.find({ userID: new ObjectId(userID) })
                .populate('productID', 'name price sellingPrice discount images stock sizes isActive')
                .lean();
        } catch (err) {
            console.log(err);
            throw new ApplicationError("Something went wrong with database", 500);
        }
    }

    async delete(userID, cartItemId) {
        try {
            if (!mongoose.isValidObjectId(cartItemId)) return false;
            const result = await cartModel.deleteOne({ _id: new ObjectId(cartItemId), userID: new ObjectId(userID) });
            return result.deletedCount > 0;
        } catch (err) {
            console.log(err);
            throw new ApplicationError("Something went wrong with database", 500);
        }
    }
}
