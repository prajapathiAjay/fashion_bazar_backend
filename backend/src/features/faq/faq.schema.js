import mongoose from "mongoose"

// The sections of the Help centre, in the order the website shows them.
// The website and admin panel get this list from the API, so this is the only place to change it.
export const FAQ_TOPICS = ["Orders & payment", "Shipping & returns", "Selling on Fashion Bazar", "Account"]

// One question on the website's FAQ page (/help/faq)
const faqSchema = new mongoose.Schema({
    topic: { type: String, required: true, enum: FAQ_TOPICS },
    question: { type: String, required: true, trim: true, maxlength: 160 },
    answer: { type: String, required: true, trim: true, maxlength: 600 },
    // drafts are only seen in the admin panel
    isPublished: { type: Boolean, default: false },
}, { timestamps: true })

export const FaqModel = mongoose.model("Faq", faqSchema)
