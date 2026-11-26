import mongoose from "mongoose";


const addressSchema = new mongoose.Schema({
    tag: {
        type: String,
        enum: ["Home", "Work", "Other"],
        default: "Home"
    },
    line1: {
        type: String,
        required: true
    },
    line2: {
        type: String,

    },
    city: {
        type: String
    },

    state: {
        type: String
    },
    pinCode: {
        type: String,
        required: true,
        match: [/^\d{6}$/, "Pincode must be 6 digits"],
    },
    isDefault: { type: Boolean, default: false },

}, { timestamps: true })


export const userSchema = new mongoose.Schema({
    firstName: { type: String, maxLength: [25, "Name can't be greater than 25 characters"] },
    lastName: { type: String },
    email: {
        type: String,
        unique: true,
        required: true,
        // saved as typed-in-lowercase, so the same address can't become two accounts
        lowercase: true,
        trim: true,
    },
    password: {
        type: String,
    },
    phone: { type: String },
    dob: { type: String },
    addresses: [addressSchema],
    type: { type: String, enum: ["user","admin"] , default:"user"},
    // forgot password: hash of the emailed token, and when that link stops working
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },
    // when the password last changed: login tokens issued before this stop working
    // (so changing the password logs out every other device)
    passwordChangedAt: { type: Date }
}, { timestamps: true })