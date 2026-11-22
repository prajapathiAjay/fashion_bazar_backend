import express from "express"
import reviewController from "./review.controller.js"

// Admin panel: moderate reviews (hide / reply / delete).
// Mounted in server.js behind jwtAuth + isAdmin.
const reviewAdminRouter = express.Router()
const reviewCtrl = new reviewController()

reviewAdminRouter.get("/", (req, res) => reviewCtrl.getAllForAdmin(req, res))
reviewAdminRouter.patch("/:id", (req, res) => reviewCtrl.moderate(req, res))
reviewAdminRouter.delete("/:id", (req, res) => reviewCtrl.removeForAdmin(req, res))

export default reviewAdminRouter
