import ShippingRepository from "./shipping.repository.js";
import { ApplicationError } from "../../error-handler/applicationError.js";

// Only what shoppers need (no ids / timestamps)
const publicView = (s) => ({ standard: s.standard, express: s.express, updatedAt: s.updatedAt });

export default class ShippingController {
    constructor() {
        this.shippingRepository = new ShippingRepository();
    }

    // GET /api/shipping  (public: cart + checkout pages)
    // GET /api/admin/shipping
    async get(req, res) {
        try {
            const settings = await this.shippingRepository.get();
            return res.status(200).json({ success: true, data: publicView(settings) });
        } catch (error) {
            console.log(error);
            return res.status(500).json({ success: false, message: "Could not load shipping settings" });
        }
    }

    // PATCH /api/admin/shipping  body: { standard?: {...}, express?: {...} }
    async update(req, res) {
        try {
            const settings = await this.shippingRepository.update(req.body);
            return res.status(200).json({ success: true, message: "Shipping settings saved", data: publicView(settings) });
        } catch (error) {
            const status = error instanceof ApplicationError ? error.code : 500;
            if (status === 500) console.log(error);
            return res.status(status).json({
                success: false,
                message: status === 500 ? "Could not save shipping settings" : error.message,
            });
        }
    }
}
