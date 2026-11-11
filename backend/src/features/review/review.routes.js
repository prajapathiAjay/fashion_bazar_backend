import express, { Router } from "express"

import reviewController from "./review.controller.js"
import jwtAuth from "../../middlewares/jwt.middleware.js"


const reviewRouter = express.Router()
const reviewCtrl = new reviewController()

reviewRouter.post("/", jwtAuth, (req, res, next) => reviewCtrl.addReview(req, res, next));
reviewRouter.get("/:Id", (req, res, next) => reviewCtrl.getAllReviews(req, res, next))

export default reviewRouter











