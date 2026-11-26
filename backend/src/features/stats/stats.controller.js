import StatsRepository, { RANGES } from "./stats.repository.js";

// ?range=7d | 30d | 12m (anything else -> 30d)
const readRange = (req) => (RANGES.includes(req.query.range) ? req.query.range : "30d");

export default class StatsController {
    constructor() {
        this.statsRepository = new StatsRepository();
    }

    // GET /api/admin/stats/dashboard?range=30d
    async dashboard(req, res) {
        try {
            const data = await this.statsRepository.dashboard(readRange(req));
            return res.status(200).json({ success: true, data });
        } catch (error) {
            console.log(error);
            return res.status(500).json({ success: false, message: "Could not load dashboard numbers" });
        }
    }

    // GET /api/admin/stats/analytics?range=30d
    async analytics(req, res) {
        try {
            const data = await this.statsRepository.analytics(readRange(req));
            return res.status(200).json({ success: true, data });
        } catch (error) {
            console.log(error);
            return res.status(500).json({ success: false, message: "Could not load analytics" });
        }
    }
}
