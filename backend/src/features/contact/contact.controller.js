import { ContactMessageModel, SubscriberModel } from "./contact.schema.js"
import { sendEmail } from "../../config/nodemailer.js"
import { contactMessageEmail } from "../../helper/contactMessageEmail.js"

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const text = (value) => (typeof value === "string" ? value.trim() : "")

export default class ContactController {

    // POST /api/contact   { name, email, orderId?, topic, message }
    async sendMessage(req, res) {
        try {
            const name = text(req.body.name)
            const email = text(req.body.email)
            const topic = text(req.body.topic)
            const message = text(req.body.message)

            if (!name || !topic || !message) {
                return res.status(400).json({ success: false, message: "Please fill in your name, a topic and a message" })
            }
            if (!EMAIL_PATTERN.test(email)) {
                return res.status(400).json({ success: false, message: "Please enter a valid email address" })
            }

            const orderId = text(req.body.orderId)
            await ContactMessageModel.create({ name, email, topic, message, orderId })
            res.status(201).json({ success: true, message: "Message sent" })

            // Tell the shop owner by email. The message is already saved, so if this fails
            // the shopper still sees "sent" and nothing is lost: we only log the error.
            // CONTACT_NOTIFY_EMAIL in .env is where alerts go (defaults to the shop's Gmail).
            sendEmail({
                to: process.env.CONTACT_NOTIFY_EMAIL || process.env.GMAIL,
                replyTo: email,
                subject: `New message: ${topic} — from ${name}`,
                html: contactMessageEmail({ name, email, orderId, topic, message }),
            }).catch((mailErr) => console.log("Contact email failed:", mailErr))
            return
        } catch (error) {
            console.log(error)
            return res.status(500).json({ success: false, message: "Could not send your message. Please try again." })
        }
    }

    // ---------- Admin panel (mounted behind jwtAuth + isAdmin) ----------

    // GET /api/admin/messages -> every Contact page message, newest first
    async getAllForAdmin(req, res) {
        try {
            const messages = await ContactMessageModel.find().sort({ createdAt: -1 }).lean()
            return res.status(200).json({ success: true, data: messages })
        } catch (error) {
            console.log(error)
            return res.status(500).json({ success: false, message: "Could not load messages" })
        }
    }

    // PATCH /api/admin/messages/:id   { isResolved: true | false }
    async setResolved(req, res) {
        try {
            if (typeof req.body?.isResolved !== "boolean") {
                return res.status(400).json({ success: false, message: "isResolved must be true or false" })
            }
            const updated = await ContactMessageModel.findByIdAndUpdate(
                req.params.id,
                { isResolved: req.body.isResolved },
                { new: true }
            )
            if (!updated) {
                return res.status(404).json({ success: false, message: "Message not found" })
            }
            return res.status(200).json({ success: true, data: updated })
        } catch (error) {
            console.log(error)
            // a badly formed id is the visitor's mistake, not a server error
            if (error.name === "CastError") {
                return res.status(404).json({ success: false, message: "Message not found" })
            }
            return res.status(500).json({ success: false, message: "Could not update the message" })
        }
    }

    // DELETE /api/admin/messages/:id
    async removeForAdmin(req, res) {
        try {
            const deleted = await ContactMessageModel.findByIdAndDelete(req.params.id)
            if (!deleted) {
                return res.status(404).json({ success: false, message: "Message not found" })
            }
            return res.status(200).json({ success: true, message: "Message deleted" })
        } catch (error) {
            console.log(error)
            if (error.name === "CastError") {
                return res.status(404).json({ success: false, message: "Message not found" })
            }
            return res.status(500).json({ success: false, message: "Could not delete the message" })
        }
    }

    // POST /api/contact/subscribe   { email }
    async subscribe(req, res) {
        try {
            const email = text(req.body.email).toLowerCase()
            if (!EMAIL_PATTERN.test(email)) {
                return res.status(400).json({ success: false, message: "Please enter a valid email address" })
            }

            // upsert: signing up twice with the same address is not an error
            await SubscriberModel.updateOne({ email }, { $setOnInsert: { email } }, { upsert: true })
            return res.status(201).json({ success: true, message: "Subscribed" })
        } catch (error) {
            console.log(error)
            return res.status(500).json({ success: false, message: "Could not subscribe. Please try again." })
        }
    }
}
