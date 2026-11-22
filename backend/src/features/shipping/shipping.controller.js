import ShippingRepository from "./shipping.repository.js";
import { ApplicationError } from "../../error-handler/applicationError.js";

const fail = (res, error, fallback) => {
    const status = error instanceof ApplicationError ? error.code : 500;
    if (status === 500) console.log(error);
    return res.status(status).json({ success: false, message: status === 500 ? fallback : error.message });
};

export default class ShippingController {
    constructor() {
        this.shippingRepository = new ShippingRepository();
    }

    // GET /api/shipping  (public: cart + checkout) -> only enabled methods, in display order
    async listPublic(req, res) {
        try {
            const methods = await this.shippingRepository.list({ onlyEnabled: true });
            const data = methods.map(({ code, name, description, price, freeAbove, minDays, maxDays }) => ({
                code, name, description, price, freeAbove, minDays, maxDays,
            }));
            return res.status(200).json({ success: true, data });
        } catch (error) {
            return fail(res, error, "Could not load delivery options");
        }
    }

    // GET /api/admin/shipping -> every method, including switched-off ones
    async list(req, res) {
        try {
            const methods = await this.shippingRepository.list();
            return res.status(200).json({ success: true, data: methods });
        } catch (error) {
            return fail(res, error, "Could not load shipping methods");
        }
    }

    // GET /api/admin/shipping/:id
    async getById(req, res) {
        try {
            const method = await this.shippingRepository.getById(req.params.id);
            return res.status(200).json({ success: true, data: method });
        } catch (error) {
            return fail(res, error, "Could not load the shipping method");
        }
    }

    // POST /api/admin/shipping  body: { name, description?, price, freeAbove?, minDays, maxDays, enabled? }
    async create(req, res) {
        try {
            const method = await this.shippingRepository.create(req.body);
            return res.status(201).json({ success: true, message: "Shipping method created", data: method });
        } catch (error) {
            return fail(res, error, "Could not create the shipping method");
        }
    }

    // PATCH /api/admin/shipping/:id  (any of the fields above; code can't change)
    async update(req, res) {
        try {
            const method = await this.shippingRepository.update(req.params.id, req.body);
            return res.status(200).json({ success: true, message: "Shipping method saved", data: method });
        } catch (error) {
            return fail(res, error, "Could not save the shipping method");
        }
    }

    // DELETE /api/admin/shipping/:id
    async remove(req, res) {
        try {
            await this.shippingRepository.remove(req.params.id);
            return res.status(200).json({ success: true, message: "Shipping method deleted" });
        } catch (error) {
            return fail(res, error, "Could not delete the shipping method");
        }
    }
}
