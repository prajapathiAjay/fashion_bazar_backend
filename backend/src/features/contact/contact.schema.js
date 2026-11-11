import mongoose from "mongoose"

// A message sent from the Contact page
const contactMessageSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    orderId: { type: String, trim: true, maxlength: 100, default: "" },
    topic: { type: String, required: true, trim: true, maxlength: 100 },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    isResolved: { type: Boolean, default: false },
}, { timestamps: true })

// An email address signed up to the newsletter
const subscriberSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 200 },
}, { timestamps: true })

export const ContactMessageModel = mongoose.model("ContactMessage", contactMessageSchema)
export const SubscriberModel = mongoose.model("Subscriber", subscriberSchema)
