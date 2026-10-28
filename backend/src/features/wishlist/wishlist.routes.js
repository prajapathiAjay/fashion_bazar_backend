import express from "express";
import wishlistController from "./wishlist.controller.js";  

const wishlistCtrl = new wishlistController();
const wishListRouter=express.Router();

wishListRouter.get("/",(req,res,next)=>{
   wishlistCtrl.getWishList(req,res,next)
})

wishListRouter.post("/",(req,res,next)=>{
    wishlistCtrl.addToWishList(req,res,next)
})
wishListRouter.delete("/:id",(req,res,next)=>{
    wishlistCtrl.removeFromWishList(req,res,next)
})

export default wishListRouter;
