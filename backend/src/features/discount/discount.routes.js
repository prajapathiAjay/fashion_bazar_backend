import express from 'express';
import { cartModel } from '../cartItems/cartItems.schema.js';
import DiscountRepository from './discount.repository.js';
import { ApplicationError } from '../../error-handler/applicationError.js';
import { unitPrice } from '../../helper/buildOrderData.js';

// Shoppers: check a coupon at checkout.
// Mounted at /api/discounts behind jwtAuth (we need to know who is asking, for "once per customer").
const discountRouter = express.Router();
const discountRepo = new DiscountRepository();

// POST /api/discounts/apply   body: { code }
// Works out the discount on the shopper's CURRENT cart (prices from the database, not the browser).
// Nothing is saved here: the use is only counted when the order is placed.
discountRouter.post("/apply", async (req, res) => {
    try {
        const cartItems = await cartModel.find({ userID: req.userID }).populate("productID");
        if (cartItems.length === 0) throw new ApplicationError("Your cart is empty", 400);
        // same sale prices the order will charge
        const subTotal = cartItems.reduce((sum, i) => sum + unitPrice(i.productID) * i.quantity, 0);

        const { discount, amount } = await discountRepo.validateForCheckout(req.body?.code, req.userID, subTotal);

        return res.status(200).json({
            success: true,
            message: `Coupon ${discount.code} applied`,
            // the rule is sent too, so the page can redo the maths if the cart changes
            data: {
                code: discount.code,
                type: discount.type,
                value: discount.value,
                maxDiscount: discount.maxDiscount,
                minOrder: discount.minOrder,
                amount,
                subTotal,
            },
        });
    } catch (error) {
        const status = error instanceof ApplicationError ? error.code : 500;
        if (status === 500) console.log(error);
        return res.status(status).json({ success: false, message: status === 500 ? "Could not check the coupon" : error.message });
    }
});

export default discountRouter;
