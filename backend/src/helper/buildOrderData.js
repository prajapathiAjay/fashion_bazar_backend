import mongoose from "mongoose";
import { ApplicationError } from "../error-handler/applicationError.js";
import { cartModel } from "../features/cartItems/cartItems.schema.js";
import { userSchema } from "../features/user/user.schema.js";
import ShippingRepository from "../features/shipping/shipping.repository.js";
import { calcShippingCost } from "../features/shipping/shipping.schema.js";
import DiscountRepository from "../features/discount/discount.repository.js";

// Reuse the model if the user repository already registered it
const UserModel = mongoose.models.User || mongoose.model("User", userSchema);

const shippingRepo = new ShippingRepository();

// The price the shopper pays for one unit (same rule as the website's getPrices):
// sellingPrice when saved, otherwise price minus discount %. Never the MRP when there's a sale.
export const unitPrice = (product) => {
    if (!product) return 0;
    if (product.sellingPrice != null) return Math.round(Number(product.sellingPrice));
    const percent = Number(product.discount) || 0;
    return Math.round((Number(product.price) || 0) * (100 - percent) / 100);
};
const discountRepo = new DiscountRepository();

// Validates the checkout and calculates everything for an order.
// Does NOT change the database (no stock change, no order, cart untouched).
// data = { address, shipMethod, couponCode? } from the checkout page
// shipMethod = the code of a delivery option from the admin's Shipping page ("standard", "same-day", ...);
// if it's missing, the first enabled option is used
export default async function buildOrderData(userId, data = {}) {
    const { address, shipMethod, couponCode } = data;

    // The chosen delivery option (must exist and be switched on)
    const shippingMethod = await shippingRepo.getForCheckout(shipMethod);

    // 1. Load the user and pick the address from their saved addresses
    //    (don't trust the address object coming from the browser)
    const user = await UserModel.findById(userId);
    if (!user) throw new ApplicationError("User not found", 404);

    const savedAddress = user.addresses.id(address?._id);
    if (!savedAddress) throw new ApplicationError("Please select a valid address", 400);

    // the courier needs a number to call (Cash on delivery especially)
    const phone = String(user.phone ?? "").replace(/\D/g, "").slice(-10);
    if (!/^[6-9]\d{9}$/.test(phone)) {
        throw new ApplicationError("Please add a valid 10-digit mobile number in your profile before ordering", 400);
    }

    // 2. Get the cart with product details
    const cartItems = await cartModel.find({ userID: userId }).populate("productID");
    if (cartItems.length === 0) throw new ApplicationError("Your cart is empty", 400);

    const items = [];
    for (const cartItem of cartItems) {
        const product = cartItem.productID;
        if (!product || product.isActive === false) {
            throw new ApplicationError(`${product?.name ?? "A product in your bag"} is no longer available. Please remove it from your bag.`, 400);
        }
        if (product.stock < cartItem.quantity) {
            throw new ApplicationError(`Only ${product.stock} left of ${product.name}`, 400);
        }
        items.push({
            product: product._id,
            name: product.name,
            image: product.images?.[0],
            price: unitPrice(product),
            size: cartItem.size,
            quantity: cartItem.quantity,
        });
    }

    // 3. Calculate totals on the server
    const subTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    // free-shipping rules look at the cart value before the coupon
    const shipping = calcShippingCost(shippingMethod, subTotal);

    // coupon: checked again here (never trust the amount shown in the browser)
    let discountInfo = null;
    if (couponCode) {
        const { discount, amount } = await discountRepo.validateForCheckout(couponCode, userId, subTotal);
        discountInfo = { code: discount.code, amount };
    }
    const totalAmount = subTotal + shipping - (discountInfo?.amount ?? 0);

    // 4. Copy of the address for the order, so later edits to the user's address don't change it
    const shippingAddress = {
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email,
        phone,
        tag: savedAddress.tag,
        line1: savedAddress.line1,
        line2: savedAddress.line2,
        city: savedAddress.city,
        state: savedAddress.state,
        pinCode: savedAddress.pinCode,
    };

    // what the order remembers about the delivery option (it may be renamed or deleted later)
    const shippingInfo = {
        code: shippingMethod.code,
        name: shippingMethod.name,
        minDays: shippingMethod.minDays,
        maxDays: shippingMethod.maxDays,
    };

    return { items, shippingAddress, subTotal, shipping, totalAmount, shippingInfo, discountInfo };
}



