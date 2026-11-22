import mongoose from "mongoose";

// One line in the order: a copy of the product as it was when bought
const orderItemSchema = new mongoose.Schema({
    product:  { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name:     { type: String, required: true },
    image:    { type: String },
    price:    { type: Number, required: true },        // price per unit at purchase time
    size:     { type: String },
    quantity: { type: Number, required: true, min: 1 },
}, { _id: false });


const orderSchema = new mongoose.Schema({
    orderNumber: { type: String, unique: true },       // "BZ-10527", shown to the customer
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    items: [orderItemSchema],

    // a copy of the address, so later edits to the user's address don't change this order
    shippingAddress: {
        name:    { type: String, required: true },
        phone:   { type: String },
        tag:     { type: String },
        line1:   { type: String, required: true },
        line2:   { type: String },
        city:    { type: String },
        state:   { type: String },
        pinCode: { type: String, required: true },
    },

    // delivery option chosen at checkout (code from the Shipping page, e.g. "standard", "same-day").
    // The name and days are copied so the order still shows them if the option is renamed or deleted.
    shippingMethod:     { type: String, default: "standard" },
    shippingMethodName: { type: String },
    deliveryDays:       { min: { type: Number }, max: { type: Number } },

    paymentMethod: { type: String, enum: ["cod", "razorpay"], required: true },
    paymentStatus: {
        type: String,
        enum: ["Pending", "Paid", "Failed", "Refunded"],
        default: "Pending",
    },
    // filled only for online (Razorpay) orders
    paymentInfo: {
        // unique: if /verify-payment and the webhook run at the same moment, only one order is saved.
        // sparse: COD orders don't have this field, so they don't clash with each other.
        razorpayOrderId:   { type: String, unique: true, sparse: true },
        razorpayPaymentId: { type: String },
        paidAt:            { type: Date },
    },

    subTotal:    { type: Number, required: true },     // sum of price * quantity
    shipping:    { type: Number, required: true },     // 0 / 99 / 199
    totalAmount: { type: Number, required: true },     // subTotal + shipping

    status: {
        type: String,
        enum: ["Ordered", "Packed", "Shipped", "Delivered", "Cancelled"],
        default: "Ordered",
    },
}, { timestamps: true });                              // createdAt = order date, updatedAt = last status change


export const OrderModel = mongoose.model("Order", orderSchema);
