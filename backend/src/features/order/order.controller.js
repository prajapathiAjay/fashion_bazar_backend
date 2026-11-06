import OrderRepository from "./order.repository.js";
import { ApplicationError } from "../../error-handler/applicationError.js";


export default class OrderController {
    constructor() {
        this.orderRepository = new OrderRepository();
    }

    // async placeOrder(req, res, next){
    //     try{
    //         const userId = req.userID;
    //         await this.orderRepository.placeOrder(userId);
    //         res.status(201).send("Order is created");
    //     }catch(err){
    //         console.log(err);
    //         return res.status(200).send("Something went wrong");
    //     }
    // }


    async placeOrder(req, res, next) {
        const data = req.body
        try {
            const userId = req.userID;
            const response = await this.orderRepository.placeOrder(userId, data);
            return res.status(201).json({ success: true, message: "Order is created", data: response });
        } catch (error) {
            const status = error instanceof ApplicationError ? error.code : 500;
            return res.status(status).json({ success: false, message: error.message });
        }
    }

    async getMyOrders(req, res, next) {
        try {
            const orders = await this.orderRepository.getMyOrders(req.userID);
            return res.status(200).json({ success: true, data: orders });
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }
}
