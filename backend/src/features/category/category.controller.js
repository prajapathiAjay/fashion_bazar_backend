import mongoose from "mongoose";
import CategoryRepository from "./category.repository.js";



export default class CategoryController {

    constructor() {
        this.categoryRepository = new CategoryRepository();

    }

    async createCategory(req, res, next) {
        const categoryData = req.body

        try {
            const createdCategory = await this.categoryRepository.createCategory(categoryData)
            return res.status(201).json({ success: true, message: "category created Successfully",createdCategory })



        } catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }


    }

    async getAllCategory(req,res,next){
      
        try {
            const categories=await this.categoryRepository.getAllCategory()
            return res.status(200).json({success:true,message:"category fetched Successsully",data:categories})
        } catch (error) {
             return res.status(500).json({
                success: false,
                message: error.message,
            });
        }



    }

    async getCategoryById(req, res, next) {
        const { id } = req.params

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid category id" })
        }

        try {
            const category = await this.categoryRepository.getCategoryById(id)
            if (!category) {
                return res.status(404).json({ success: false, message: "Category not found" })
            }
            return res.status(200).json({ success: true, message: "category fetched Successfully", data: category })
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }

    async updateCategory(req, res, next) {
         const {id}=req.params
         const updateData=req.body

        if(!mongoose.Types.ObjectId.isValid(id)){
            return res.status(400).json({success:false,message:"Invalid category id"})
        }

        try{
            const updatedCategory=await this.categoryRepository.updateCategory(id,updateData)
            if(!updatedCategory){
                return res.status(404).json({success:false,message:"category not found"})
            }
            return res.status(200).json({success:true,message:"category updated successfully",data:updatedCategory})

        }catch(error){
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }



    }

    async deleteCategory(req, res, next) {
        const { id } = req.params

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid category id" })
        }

        try {
            const deletedCategory = await this.categoryRepository.deleteCategory(id)
            if (!deletedCategory) {
                return res.status(404).json({ success: false, message: "category not found" })
            }
            return res.status(200).json({ success: true, message: "category deleted successfully", data: deletedCategory })
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    }

}