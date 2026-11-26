import CartItemsRepository from './cartItems.repository.js';
import { ApplicationError } from '../../error-handler/applicationError.js';

// ApplicationErrors carry their own status (400 "out of stock", 404 ...), anything else is a 500
const sendError = (res, err) => {
  if (err instanceof ApplicationError) {
    return res.status(err.code).json({ success: false, message: err.message });
  }
  console.log(err);
  return res.status(500).json({ success: false, message: "Something went wrong, please try again" });
};

// quantity must be a whole number, at least 1 (no 0, -1 or 1.5)
const isValidQuantity = (q) => Number.isInteger(q) && q >= 1;

export class CartItemsController {

  constructor() {
    this.cartItemsRepository = new CartItemsRepository();
  }

  async add(req, res) {
    try {
      const { productID, size } = req.body;
      const quantity = req.body.quantity ?? 1;
      if (!productID) {
        return res.status(400).json({ success: false, message: "Valid product ID is required" });
      }
      if (!isValidQuantity(quantity)) {
        return res.status(400).json({ success: false, message: "Quantity must be a whole number, at least 1" });
      }

      const cart = await this.cartItemsRepository.add({ productID, quantity, size, userID: req.userID });
      res.status(201).json({ success: true, message: "Item added to cart successfully", data: cart });
    } catch (err) {
      return sendError(res, err);
    }
  }

  async updateCart(req, res) {
    try {
      const { id } = req.params;
      const { quantity, size } = req.body;
      const fields = {};

      if (quantity !== undefined) {
        if (!isValidQuantity(quantity)) {
          return res.status(400).json({ success: false, message: "Quantity must be a whole number, at least 1" });
        }
        fields.quantity = quantity;
      }
      if (size !== undefined) fields.size = size;

      if (Object.keys(fields).length === 0) {
        return res.status(400).json({ success: false, message: "Send quantity or size to update" });
      }

      const item = await this.cartItemsRepository.updateCartItem(req.userID, id, fields);
      if (!item) return res.status(404).json({ success: false, message: "Item not found" });

      res.status(200).json(item);
    } catch (err) {
      return sendError(res, err);
    }
  }

  async get(req, res) {
    try {
      const items = await this.cartItemsRepository.get(req.userID);
      return res.status(200).json({ success: true, message: "Cart items retrieved successfully", data: items });
    } catch (err) {
      return sendError(res, err);
    }
  }

  async delete(req, res) {
    try {
      const deletedItem = await this.cartItemsRepository.delete(req.userID, req.params.id);
      return res.status(200).json({ success: true, message: "Cart item deleted successfully", data: deletedItem });
    } catch (err) {
      return sendError(res, err);
    }
  }
}
