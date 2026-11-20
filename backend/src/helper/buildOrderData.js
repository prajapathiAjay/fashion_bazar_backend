import mongoose from "mongoose";
import { ApplicationError } from "../error-handler/applicationError.js";
import { cartModel } from "../features/cartItems/cartItems.schema.js";
import { userSchema } from "../features/user/user.schema.js";

// Reuse the model if the user repository already registered it
const UserModel = mongoose.models.User || mongoose.model("User", userSchema);

// Same rule as the checkout page
export const getShippingCost = (shippingMethod, subTotal) => {
    if (shippingMethod === "express") return 199;
    return subTotal >= 999 ? 0 : 99;
};

// Validates the checkout and calculates everything for an order.
// Does NOT change the database (no stock change, no order, cart untouched).
// data = { address, shipMethod } from the checkout page
export default async function buildOrderData(userId, data = {}) {
    const { address, shipMethod = "standard" } = data;

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

    // 4. Copy of the address for the order, so later edits to the user's address don't change it
    const shippingAddress = {
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email,
        phone: user.phone,
        tag: savedAddress.tag,
        line1: savedAddress.line1,
        line2: savedAddress.line2,
        city: savedAddress.city,
        state: savedAddress.state,
        pinCode: savedAddress.pinCode,
    };

    return { items, shippingAddress, subTotal, shipping, totalAmount };
}



