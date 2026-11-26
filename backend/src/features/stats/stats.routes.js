import express from "express";
import StatsController from "./stats.controller.js";

// Admin panel: Dashboard + Analytics numbers (read only).
// Mounted in server.js at /api/admin/stats behind jwtAuth + isAdmin.
const statsAdminRouter = express.Router();
const statsController = new StatsController();

statsAdminRouter.get("/dashboard", (req, res) => statsController.dashboard(req, res));
statsAdminRouter.get("/analytics", (req, res) => statsController.analytics(req, res));

export default statsAdminRouter;
