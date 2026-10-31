import { ObjectId } from "mongodb";
import { getDB } from "../../config/mongodb.js";
import {ApplicationError} from "../../error-handler/applicationError.js";
import { cartModel } from "./cartItems.schema.js";
export default class CartItemsRepository {

    constructor() {
        this.collection = "cartItems";
    }

    async add(productID, userID, quantity=1) {
        try {
            // const db = getDB();
            // const collection = db.collection(this.collection)
            // const id = await this.getNextCounter(db);
            // find the document
            // either insert or update
            // Insertion.
          return  await cartModel.updateOne(
                { productID: new ObjectId(productID), userID: new ObjectId(userID) },
                {
                    // $setOnInsert: { _id: id },
                    $inc: {
                        quantity: quantity
                    }
                },
                { upsert: true })

        } catch (err) {
            console.log(err);
            throw new ApplicationError(err, 500);
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

    async delete(userID, cartItemID) {
        try {
            const db = getDB();
            const collection = db.collection(this.collection)
            const result = await collection.deleteOne({ _id: new ObjectId(cartItemID), userID: new ObjectId(userID) });
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