import { StoreSettingsModel } from "./settings.schema.js"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// digits, spaces, +, -, ( ) only
const PHONE_PATTERN = /^[+\d][\d\s()-]*$/

// field -> [max length, friendly name]
const FIELDS = {
    storeName: [60, "Store name"],
    supportEmail: [200, "Support email"],
    supportPhone: [30, "Support phone"],
    supportHours: [100, "Support hours"],
    address: [300, "Address"],
}

// only the fields the website needs (no _id / timestamps)
const toPublic = (doc) => ({
    storeName: doc?.storeName ?? "Fashion Bazar",
    supportEmail: doc?.supportEmail ?? "",
    supportPhone: doc?.supportPhone ?? "",
    supportHours: doc?.supportHours ?? "",
    address: doc?.address ?? "",
})

export default class SettingsController {

    // GET /api/settings (website, no login) and GET /api/admin/settings
    // Before the admin saves anything there is no document yet, so send the defaults.
    async get(req, res) {
        try {
            const settings = await StoreSettingsModel.findOne().lean()
            return res.status(200).json({ success: true, data: toPublic(settings) })
        } catch (error) {
            console.log(error)
            return res.status(500).json({ success: false, message: "Could not load store details" })
        }
    }

    // PATCH /api/admin/settings   any of { storeName, supportEmail, supportPhone, supportHours, address }
    async update(req, res) {
        try {
            const data = {}
            for (const [key, [max, label]] of Object.entries(FIELDS)) {
                const value = req.body?.[key]
                if (value === undefined) continue
                if (typeof value !== "string") {
                    return res.status(400).json({ success: false, message: `${label} must be text` })
                }
                const trimmed = value.trim()
                if (trimmed.length > max) {
                    return res.status(400).json({ success: false, message: `${label} can be at most ${max} characters` })
                }
                data[key] = trimmed
            }

            if (data.storeName === "") {
                return res.status(400).json({ success: false, message: "Store name can't be empty" })
            }
            if (data.supportEmail && !EMAIL_PATTERN.test(data.supportEmail)) {
                return res.status(400).json({ success: false, message: "Please enter a valid support email" })
            }
            if (data.supportPhone && !PHONE_PATTERN.test(data.supportPhone)) {
                return res.status(400).json({ success: false, message: "Phone can only have digits, spaces, +, - and brackets" })
            }

            // upsert: the first save creates the single settings document
            const settings = await StoreSettingsModel.findOneAndUpdate({}, data, {
                new: true,
                upsert: true,
                runValidators: true,
                setDefaultsOnInsert: true,
            }).lean()
            return res.status(200).json({ success: true, data: toPublic(settings) })
        } catch (error) {
            console.log(error)
            return res.status(500).json({ success: false, message: "Could not save store details" })
        }
    }
}
