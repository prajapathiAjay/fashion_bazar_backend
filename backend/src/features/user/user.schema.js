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
        //   match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please enter a valid email"]
    },
    password: {
        type: String,
        // validate:{
        //     validator: function(value){
        //         return /^(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,12}$/.test(value)
        //     },
        //     message:"Password should be between 8-12 charachetrs and have a special character"
        // }
    },
    phone: { type: String },
    dob: { type: String },
    addresses: [addressSchema],
    type: { type: String, enum: ['Customer', 'Seller'] }
}, { timestamps: true })