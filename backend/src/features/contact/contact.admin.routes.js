import express from "express"
import ContactController from "./contact.controller.js"

// Admin panel: read Contact page messages, mark them resolved, delete them.
// Mounted in server.js behind jwtAuth + isAdmin.
const contactAdminRouter = express.Router()
const contactController = new ContactController()

contactAdminRouter.get("/", (req, res) => contactController.getAllForAdmin(req, res))
contactAdminRouter.patch("/:id", (req, res) => contactController.setResolved(req, res))
contactAdminRouter.delete("/:id", (req, res) => contactController.removeForAdmin(req, res))

export default contactAdminRouter
