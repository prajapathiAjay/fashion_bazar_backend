
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







}