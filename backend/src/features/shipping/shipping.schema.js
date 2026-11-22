import mongoose from "mongoose";

// Settings for one delivery method (standard or express)
const methodSchema = new mongoose.Schema({
    enabled:   { type: Boolean, default: true },
    price:     { type: Number, required: true, min: 0 },      // ₹ charged
    freeAbove: { type: Number, min: 0, default: null },        // free when subtotal >= this; null = never free
    minDays:   { type: Number, required: true, min: 0 },       // delivery estimate shown to shoppers
    maxDays:   { type: Number, required: true, min: 0 },
}, { _id: false });

// Only ONE settings document exists (key: "default").
// The method names stay fixed because orders store shippingMethod as "standard" | "express".
const shippingSettingsSchema = new mongoose.Schema({
    key: { type: String, default: "default", unique: true },
    standard: { type: methodSchema, default: () => ({ enabled: true, price: 99, freeAbove: 999, minDays: 4, maxDays: 6 }) },
    express:  { type: methodSchema, default: () => ({ enabled: true, price: 199, freeAbove: null, minDays: 1, maxDays: 2 }) },
}, { timestamps: true });

export const ShippingSettingsModel = mongoose.model("ShippingSettings", shippingSettingsSchema);

export const SHIPPING_METHODS = ["standard", "express"];

// The one rule used everywhere (checkout totals, order creation, Razorpay amount)
export const calcShippingCost = (settings, method, subTotal) => {
    const m = settings?.[method];
    if (!m) return 0;
    if (m.freeAbove !== null && m.freeAbove !== undefined && subTotal >= m.freeAbove) return 0;
    return m.price;
};
