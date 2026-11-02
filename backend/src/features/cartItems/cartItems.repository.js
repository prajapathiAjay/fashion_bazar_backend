import { ObjectId } from "mongodb";
import { getDB } from "../../config/mongodb.js";
import { ApplicationError } from "../../error-handler/applicationError.js";
import { cartModel } from "./cartItems.schema.js";
export default class CartItemsRepository {

    constructor() {
        this.collection = "cartItems";
    }

    async add(productID, userID,) {
        try {

            const exists = await cartModel.exists({ productID: new ObjectId(productID), userID: new ObjectId(userID) })
            if (exists) {
                throw new ApplicationError("Product already exists in cart", 400);
            }
            return await cartModel.create({ productID: new ObjectId(productID), userID: new ObjectId(userID) });
        } catch (err) {
            console.log(err);
            throw new ApplicationError(err, 500);
        }
    }

    async updateCartItem(userID, cartItemId, fields) {
        try {
            return await cartModel.findOneAndUpdate(
                { _id: new ObjectId(cartItemId), userID: new ObjectId(userID) },
                { $set: fields },
                { new: true }
            ).lean();
        } catch (err) {
            console.log(err);
            throw new ApplicationError("Something went wrong with database", 500);
        }
    }



    async get(userID) {
        try {

            return await cartModel.find({ userID: new ObjectId(userID) }).populate('productID', 'name price images').lean();
        } catch (err) {
            console.log(err);
            throw new ApplicationError(err, 500);
        }
    }

    async delete(userID, cartItemId) {
        try {

            const result = await cartModel.deleteOne({ _id: new ObjectId(cartItemId), userID: new ObjectId(userID) });
            return result.deletedCount > 0;
        } catch (err) {
            console.log(err);
            throw new ApplicationError("Something went wrong with database", 500);
        }
    }

    async getNextCounter(db) {

        const resultDocument = await db.collection("counters").findOneAndUpdate(
            { _id: 'cartItemId' },
            { $inc: { value: 1 } },
            { returnDocument: 'after' }
        )
        console.log(resultDocument);
        return resultDocument.value.value;
    }
}