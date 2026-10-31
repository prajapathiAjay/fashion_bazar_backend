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
 console.log("productID", productID, "quantity", quantity, "size", size,"userID", userID);
    if (!productID ) {
    return res.status(400).json({
        success: false,
        message: "Valid product ID is required"
    });
}
     
   
      const cart=await this.cartItemsRepository.add(productID, userID, quantity, size);
      res.status(201).json({ success: true, message: "Item added to cart successfully", data: cart });
    } catch (err) {
      console.log(err);
      return res.status(500).json({success: false, message: err.message});
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
    const userID = req.userID;
    const cartItemID = req.params.id;
    const isDeleted = await this.cartItemsRepository.delete(
      userID,
      cartItemID
    );
    if (!isDeleted) {
      return res.status(404).send("Item not found");
    }
    return res
      .status(200)
      .send('Cart Item is removed');
  }
}
