import express from "express"
import SettingsController from "./settings.controller.js"

const settingsController = new SettingsController()

// Website: GET /api/settings (store name + contact details, no login)
export const settingsRouter = express.Router()
settingsRouter.get("/", (req, res) => settingsController.get(req, res))

// Admin panel: /api/admin/settings (mounted in server.js behind jwtAuth + isAdmin)
export const settingsAdminRouter = express.Router()
settingsAdminRouter.get("/", (req, res) => settingsController.get(req, res))
settingsAdminRouter.patch("/", (req, res) => settingsController.update(req, res))
