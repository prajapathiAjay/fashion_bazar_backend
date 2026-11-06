import mongoose from "mongoose";
import { OrderModel } from "./order.schema.js";
import { cartModel } from "../cartItems/cartItems.schema.js";
import { productSchema } from "../product/product.schema.js";
import { userSchema } from "../user/user.schema.js";
import { ApplicationError } from "../../error-handler/applicationError.js";

// Reuse the models if product/user repositories already registered them
const ProductModel = mongoose.models.Product || mongoose.model("Product", productSchema);
const UserModel = mongoose.models.User || mongoose.model("User", userSchema);

// Same rule as the checkout page
const getShippingCost = (shippingMethod, subTotal) => {
    if (shippingMethod === "express") return 199;
    return subTotal >= 999 ? 0 : 99;
};

export default class OrderRepository {

    // data = { address, shipMethod, payMethod } from the checkout page
    async placeOrder(userId, data = {}) {
        const { address, shipMethod = "standard", payMethod } = data;

        if (payMethod !== "cod") {
            throw new ApplicationError("Only cash on delivery is available right now", 400);
        }
        if (!["standard", "express"].includes(shipMethod)) {
            throw new ApplicationError("Invalid shipping method", 400);
        }

        // 1. Load the user and pick the address from their saved addresses
        //    (don't trust the address object coming from the browser)
        const user = await UserModel.findById(userId);
        if (!user) throw new ApplicationError("User not found", 404);

        const savedAddress = user.addresses.id(address?._id);
        if (!savedAddress) throw new ApplicationError("Please select a valid address", 400);

        // 2. Get the cart with product details
        const cartItems = await cartModel.find({ userID: userId }).populate("productID");
        if (cartItems.length === 0) throw new ApplicationError("Your cart is empty", 400);

        const items = [];
        for (const cartItem of cartItems) {
            const product = cartItem.productID;
            if (!product) throw new ApplicationError("A product in your cart no longer exists", 400);
            if (product.stock < cartItem.quantity) {
                throw new ApplicationError(`Only ${product.stock} left of ${product.name}`, 400);
            }
            items.push({
                product: product._id,
                name: product.name,
                image: product.images?.[0],
                price: product.price,
                size: cartItem.size,
                quantity: cartItem.quantity,
            });
        }

        // 3. Calculate totals on the server
        const subTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const shipping = getShippingCost(shipMethod, subTotal);
        const totalAmount = subTotal + shipping;

        // 4. Reduce stock. The {stock: {$gte}} check stops two orders buying the last piece.
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

            // 5. Create the order
            const order = await OrderModel.create({
                orderNumber: await this.getNextOrderNumber(),
                user: userId,
                items,
                shippingAddress: {
                    name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email,
                    phone: user.phone,
                    tag: savedAddress.tag,
                    line1: savedAddress.line1,
                    line2: savedAddress.line2,
                    city: savedAddress.city,
                    state: savedAddress.state,
                    pinCode: savedAddress.pinCode,
                },
                shippingMethod: shipMethod,
                paymentMethod: payMethod,
                subTotal,
                shipping,
                totalAmount,
            });

            // 6. Clear the cart
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
