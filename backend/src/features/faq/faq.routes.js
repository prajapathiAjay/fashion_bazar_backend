import express from "express"
import FaqController from "./faq.controller.js"

const faqController = new FaqController()

// Website: GET /api/faq (published questions only, no login)
export const faqRouter = express.Router()
faqRouter.get("/", (req, res) => faqController.getPublished(req, res))

// Admin panel: /api/admin/faqs (mounted in server.js behind jwtAuth + isAdmin)
export const faqAdminRouter = express.Router()
faqAdminRouter.get("/", (req, res) => faqController.getAllForAdmin(req, res))
faqAdminRouter.post("/", (req, res) => faqController.create(req, res))
faqAdminRouter.patch("/:id", (req, res) => faqController.update(req, res))
faqAdminRouter.delete("/:id", (req, res) => faqController.remove(req, res))
