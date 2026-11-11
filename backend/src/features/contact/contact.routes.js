import express from "express"
import ContactController from "./contact.controller.js"

const contactRouter = express.Router()
const contactController = new ContactController()

// localhost:3200/api/contact
contactRouter.post("/", (req, res) => contactController.sendMessage(req, res))
contactRouter.post("/subscribe", (req, res) => contactController.subscribe(req, res))

export default contactRouter
