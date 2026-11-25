import mongoose from "mongoose"

// The shop's own details, edited in the admin panel (Settings > Store details)
// and shown on the website (footer, Contact page, legal pages).
// There is only ever ONE of these documents.
const storeSettingsSchema = new mongoose.Schema({
    storeName: { type: String, trim: true, maxlength: 60, default: "Fashion Bazar" },
    supportEmail: { type: String, trim: true, lowercase: true, maxlength: 200, default: "" },
    supportPhone: { type: String, trim: true, maxlength: 30, default: "" },
    supportHours: { type: String, trim: true, maxlength: 100, default: "" },
    address: { type: String, trim: true, maxlength: 300, default: "" },
}, { timestamps: true })

export const StoreSettingsModel = mongoose.model("StoreSettings", storeSettingsSchema)
