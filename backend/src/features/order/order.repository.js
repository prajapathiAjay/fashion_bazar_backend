import mongoose from "mongoose";
import { OrderModel } from "./order.schema.js";
import { cartModel } from "../cartItems/cartItems.schema.js";
import { productSchema } from "../product/product.schema.js";
import { ApplicationError } from "../../error-handler/applicationError.js";
import buildOrderData from "../../helper/buildOrderData.js";

// Reuse the model if the product repository already registered it
const ProductModel = mongoose.models.Product || mongoose.model("Product", productSchema);

export default class OrderRepository {

    // Cash on delivery
    // data = { address, shipMethod, payMethod } from the checkout page
    async placeOrder(userId, data = {}) {
        const { shipMethod = "standard", payMethod } = data;

        if (payMethod !== "cod") {
            throw new ApplicationError("Only cash on delivery is available right now", 400);
        }

        // 1. Validate and calculate (nothing saved yet)
        const orderData = await buildOrderData(userId, data);

        // 2. Reduce stock, save the order, clear the cart
        return await this.createOrderAndReduceStock(userId, orderData, {
            shipMethod,
            paymentMethod: "cod",
            paymentStatus: "Pending",   // COD is paid on delivery
        });
    }

    // Helper 2: the part that changes the database.
    // orderData = what buildOrderData returned
    // extra     = { shipMethod, paymentMethod, paymentStatus, paymentInfo? }
    async createOrderAndReduceStock(userId, orderData, extra) {
        const { items, shippingAddress, subTotal, shipping, totalAmount } = orderData;
        const { shipMethod, paymentMethod, paymentStatus, paymentInfo } = extra;

        // 1. Reduce stock. The {stock: {$gte}} check stops two orders buying the last piece.
        //    Your local MongoDB is not a replica set, so transactions aren't available:
        //    if one item fails, put back the stock already taken.
        const reduced = [];
        try {
            for (const item of items) {
                const result = await ProductModel.updateOne(
                    { _id: item.product, stock: { $gte: item.quantity } },
                    { $inc: { stock: -item.quantity } }
                );
                if (result.modifiedCount === 0) {
                    throw new ApplicationError(`${item.name} just went out of stock`, 400);
                }
                reduced.push(item);
            }

            // 2. Create the order
            const order = await OrderModel.create({
                orderNumber: await this.getNextOrderNumber(),
                user: userId,
                items,
                shippingAddress,
                shippingMethod: shipMethod,
                paymentMethod,
                paymentStatus,
                paymentInfo,
                subTotal,
                shipping,
                totalAmount,
            });

            // 3. Clear the cart
            await cartModel.deleteMany({ userID: userId });

            return order;
        } catch (err) {
            for (const item of reduced) {
                await ProductModel.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } });
            }
            if (err instanceof ApplicationError) throw err;
            console.log(err);
            throw new ApplicationError("Something went wrong while placing the order", 500);
        }
    }

    // All orders of the logged-in user, newest first
    async getMyOrders(userId) {
        return await OrderModel.find({ user: userId }).sort({ createdAt: -1 });
    }

    // BZ-10001, BZ-10002, ... using an atomic counter so two orders never get the same number
    async getNextOrderNumber() {
        const counter = await mongoose.connection.db.collection("counters").findOneAndUpdate(
            { _id: "orderNumber" },
            { $inc: { value: 1 } },
            { upsert: true, returnDocument: "after" }
        );
        // driver v6 returns the doc, older versions return { value: doc }
        const value = (counter?.value?.value ?? counter?.value) || 1;
        return `BZ-${10000 + value}`;
    }
}
