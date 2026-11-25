import { FaqModel, FAQ_TOPICS } from "./faq.schema.js"

const text = (value) => (typeof value === "string" ? value.trim() : "")

// Checks the fields an admin can send. `partial` = editing, so missing fields are allowed.
// Returns { data } with only the allowed fields, or { error }.
const readFaqBody = (body = {}, partial = false) => {
    const data = {}

    if (body.topic !== undefined || !partial) {
        if (!FAQ_TOPICS.includes(body.topic)) return { error: "Please choose a valid topic" }
        data.topic = body.topic
    }
    if (body.question !== undefined || !partial) {
        const question = text(body.question)
        if (!question) return { error: "Please write the question" }
        if (question.length > 160) return { error: "The question can be at most 160 characters" }
        data.question = question
    }
    if (body.answer !== undefined || !partial) {
        const answer = text(body.answer)
        if (!answer) return { error: "Please write the answer" }
        if (answer.length > 600) return { error: "The answer can be at most 600 characters" }
        data.answer = answer
    }
    if (body.isPublished !== undefined) {
        if (typeof body.isPublished !== "boolean") return { error: "isPublished must be true or false" }
        data.isPublished = body.isPublished
    }
    return { data }
}

// a badly formed id means "no such FAQ", not a server error
const notFoundOr500 = (res, error, message) => {
    console.log(error)
    if (error.name === "CastError") {
        return res.status(404).json({ success: false, message: "FAQ not found" })
    }
    return res.status(500).json({ success: false, message })
}

export default class FaqController {

    // ---------- Website (public) ----------

    // GET /api/faq -> published FAQs only, oldest first inside each topic (the order they were added)
    async getPublished(req, res) {
        try {
            const faqs = await FaqModel.find({ isPublished: true })
                .select("topic question answer")
                .sort({ createdAt: 1 })
                .lean()
            return res.status(200).json({ success: true, data: { topics: FAQ_TOPICS, faqs } })
        } catch (error) {
            console.log(error)
            return res.status(500).json({ success: false, message: "Could not load FAQs" })
        }
    }

    // ---------- Admin panel (mounted behind jwtAuth + isAdmin) ----------

    // GET /api/admin/faqs -> every FAQ including drafts, newest first
    async getAllForAdmin(req, res) {
        try {
            const faqs = await FaqModel.find().sort({ createdAt: -1 }).lean()
            return res.status(200).json({ success: true, data: { topics: FAQ_TOPICS, faqs } })
        } catch (error) {
            console.log(error)
            return res.status(500).json({ success: false, message: "Could not load FAQs" })
        }
    }

    // POST /api/admin/faqs   { topic, question, answer, isPublished? }
    async create(req, res) {
        try {
            const { data, error } = readFaqBody(req.body)
            if (error) return res.status(400).json({ success: false, message: error })
            const faq = await FaqModel.create(data)
            return res.status(201).json({ success: true, data: faq })
        } catch (error) {
            console.log(error)
            return res.status(500).json({ success: false, message: "Could not add the FAQ" })
        }
    }

    // PATCH /api/admin/faqs/:id   any of { topic, question, answer, isPublished }
    async update(req, res) {
        try {
            const { data, error } = readFaqBody(req.body, true)
            if (error) return res.status(400).json({ success: false, message: error })
            const faq = await FaqModel.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true })
            if (!faq) return res.status(404).json({ success: false, message: "FAQ not found" })
            return res.status(200).json({ success: true, data: faq })
        } catch (error) {
            return notFoundOr500(res, error, "Could not update the FAQ")
        }
    }

    // DELETE /api/admin/faqs/:id
    async remove(req, res) {
        try {
            const faq = await FaqModel.findByIdAndDelete(req.params.id)
            if (!faq) return res.status(404).json({ success: false, message: "FAQ not found" })
            return res.status(200).json({ success: true, message: "FAQ deleted" })
        } catch (error) {
            return notFoundOr500(res, error, "Could not delete the FAQ")
        }
    }
}
