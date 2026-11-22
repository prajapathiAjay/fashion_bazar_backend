import mongoose from "mongoose";

// A coupon code shoppers can apply at checkout
const discountSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,              // two offers can't share a code
        uppercase: true,
        trim: true,
        match: [/^[A-Z0-9-]{3,20}$/, "Code must be 3-20 capital letters, numbers or dashes"],
    },
    description: { type: String, trim: true, maxLength: 120 },  // only admins see this

    type:  { type: String, enum: ["percentage", "fixed"], required: true },
    value: { type: Number, required: true, min: 1 },             // 20 = 20% or ₹20

    maxDiscount: { type: Number, min: 1, default: null },        // cap in ₹ for percentage codes
    minOrder:    { type: Number, min: 0, default: 0 },           // cart total needed

    usageLimit:  { type: Number, min: 1, default: null },        // null = unlimited
    perCustomer: { type: Number, min: 1, default: 1 },

    // filled in when checkout starts using coupons
    used:               { type: Number, default: 0 },
    totalDiscountGiven: { type: Number, default: 0 },

    startsAt: { type: Date, required: true },
    endsAt:   { type: Date, default: null },                     // null = never ends
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

export const DiscountModel = mongoose.model("Discount", discountSchema);
