import CartIemModel from './cartItems.model.js';
import CartItemsRepository from './cartItems.repository.js';

export class CartItemsController {

  constructor() {
    this.cartItemsRepository = new CartItemsRepository();
  }

  async add(req, res) {
    try {
      const { productID, quantity, size } = req.body;
      const userID = req.userID;
      console.log("productID", productID, "quantity", quantity, "size", size, "userID", userID);
      if (!productID) {
        return res.status(400).json({
          success: false,
          message: "Valid product ID is required"
        });
      }
      const cartData={
        productID,
        quantity,
        size,
        userID
      }


      const cart = await this.cartItemsRepository.add(cartData);
      res.status(201).json({ success: true, message: "Item added to cart successfully", data: cart });
    } catch (err) {
      console.log(err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }


 async updateCart(req, res, next) {
    try {
        const { id } = req.params;
        const { quantity, size } = req.body;
        const fields = {};

        if (quantity !== undefined) {
            if (!Number.isInteger(quantity) || quantity < 1) {
                return res.status(400).send("Quantity must be a whole number, at least 1");
            }
            fields.quantity = quantity;
        }

        if (size !== undefined) {
            const allowedSizes = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL"];
            if (!allowedSizes.includes(size)) {
                return res.status(400).send("Invalid size");
            }
            fields.size = size;
        }

        if (Object.keys(fields).length === 0) {
            return res.status(400).send("Send quantity or size to update");
        }

        const item = await this.cartItemsRepository.updateCartItem(req.userID, id, fields);
        if (!item) return res.status(404).send("Item not found");

        res.status(200).json(item);
    } catch (err) {
        next(err);
    }
}


  async get(req, res) {
    try {
      const userID = req.userID;
      const items = await this.cartItemsRepository.get(userID);
      return res.status(200).json({ success: true, message: "Cart items retrieved successfully", data: items });
    } catch (err) {
      console.log(err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }


  async delete(req, res) {


    try {

      const userID = req.userID;
      const cartItemId = req.params.id;
      const deletedItem = await this.cartItemsRepository.delete(userID, cartItemId);
      return res.status(200).json({ success: true, message: "Cart item deleted successfully", data: deletedItem });

    } catch (err) {
      console.log(err);
      return res.status(500).json({ success: false, message: err.message });
    }


  }
}
