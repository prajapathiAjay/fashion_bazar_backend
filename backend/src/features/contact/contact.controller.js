import { ContactMessageModel, SubscriberModel } from "./contact.schema.js"

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

            await ContactMessageModel.create({ name, email, topic, message, orderId: text(req.body.orderId) })
            return res.status(201).json({ success: true, message: "Message sent" })
        } catch (error) {
            console.log(error)
            return res.status(500).json({ success: false, message: "Could not send your message. Please try again." })
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
