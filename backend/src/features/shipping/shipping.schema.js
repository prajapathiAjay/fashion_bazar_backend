import mongoose from "mongoose";

// One delivery option shoppers can pick at checkout (Standard, Express, Same day, ...)
const shippingMethodSchema = new mongoose.Schema({
    // short id saved on orders and sent by checkout, e.g. "standard", "same-day".
    // Made from the name when created and never changed, so old orders keep pointing at it.
    code: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^[a-z0-9-]{2,30}$/, "Code must be 2-30 lowercase letters, numbers or dashes"],
    },
    name:        { type: String, required: true, trim: true, maxLength: 40 },   // "Express"
    description: { type: String, trim: true, maxLength: 80 },                   // "Fastest, for urgent orders"

    price:     { type: Number, required: true, min: 0 },   // ₹ charged
    freeAbove: { type: Number, min: 0, default: null },    // free when subtotal >= this; null = never free
    minDays:   { type: Number, required: true, min: 0 },   // delivery estimate shown to shoppers
    maxDays:   { type: Number, required: true, min: 0 },

    enabled:   { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },               // smaller = shown first; the first one is the default
}, { timestamps: true });

export const ShippingMethodModel = mongoose.model("ShippingMethod", shippingMethodSchema);

// The one rule used everywhere (cart, checkout, order creation, Razorpay amount)
export const calcShippingCost = (method, subTotal) => {
    if (!method) return 0;
    if (method.freeAbove !== null && method.freeAbove !== undefined && subTotal >= method.freeAbove) return 0;
    return method.price;
};
