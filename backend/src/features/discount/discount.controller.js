import DiscountRepository from "./discount.repository.js";
import { ApplicationError } from "../../error-handler/applicationError.js";

// Send { success:false, message } with the right status
const fail = (res, error, fallback) => {
    const status = error instanceof ApplicationError ? error.code : 500;
    if (status === 500) console.log(error);
    return res.status(status).json({ success: false, message: status === 500 ? fallback : error.message });
};

export default class DiscountController {
    constructor() {
        this.discountRepository = new DiscountRepository();
    }

    // GET /api/admin/discounts
    async getAll(req, res) {
        try {
            const discounts = await this.discountRepository.getAll();
            return res.status(200).json({ success: true, data: discounts });
        } catch (error) {
            return fail(res, error, "Could not load discounts");
        }
    }

    // GET /api/admin/discounts/:id
    async getById(req, res) {
        try {
            const discount = await this.discountRepository.getById(req.params.id);
            return res.status(200).json({ success: true, data: discount });
        } catch (error) {
            return fail(res, error, "Could not load the discount");
        }
    }

    // POST /api/admin/discounts
    async create(req, res) {
        try {
            const discount = await this.discountRepository.create(req.body);
            return res.status(201).json({ success: true, message: "Discount created", data: discount });
        } catch (error) {
            return fail(res, error, "Could not create the discount");
        }
    }

    // PATCH /api/admin/discounts/:id  (any subset of fields, e.g. { isActive: false })
    async update(req, res) {
        try {
            const discount = await this.discountRepository.update(req.params.id, req.body);
            return res.status(200).json({ success: true, message: "Discount updated", data: discount });
        } catch (error) {
            return fail(res, error, "Could not update the discount");
        }
    }

    // DELETE /api/admin/discounts/:id
    async remove(req, res) {
        try {
            await this.discountRepository.remove(req.params.id);
            return res.status(200).json({ success: true, message: "Discount deleted" });
        } catch (error) {
            return fail(res, error, "Could not delete the discount");
        }
    }
}
