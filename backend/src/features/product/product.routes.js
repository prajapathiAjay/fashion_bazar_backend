// Manage routes/paths to ProductController

// 1. Import express.
import express from 'express';
import ProductController from './product.controller.js';
import jwtAuth from '../../middlewares/jwt.middleware.js';
import { isAdmin } from '../../middlewares/IsAdmin.js';

// Reading products is public (the shop). Adding, editing and deleting need an admin login.

// 2. Initialize Express router.
const productRouter = express.Router();

const productController = new ProductController();

// All the paths to controller methods (mounted at /api/products).

// must stay above '/:id', otherwise "filter-options" would be read as a product id
productRouter.get(
  '/filter-options',
  (req, res)=>{
    productController.getFilterOptions(req, res)
}
);
productRouter.get(
  '/',
  (req, res)=>{
    productController.getAllProducts(req, res)
} 
);
productRouter.post(
  '/',
  jwtAuth,
  isAdmin,
  (req, res)=>{
    productController.addProduct(req, res)
} 
);

productRouter.get(
  '/:id',
  (req, res)=>{
    productController.getOneProduct(req, res)
} );

// used by the admin panel's Edit page and Delete action
productRouter.patch('/:id', jwtAuth, isAdmin, (req, res)=>{
    productController.updateProduct(req, res)
});

productRouter.delete('/:id', jwtAuth, isAdmin, (req, res)=>{
    productController.deleteProduct(req, res)
});




export default productRouter;
