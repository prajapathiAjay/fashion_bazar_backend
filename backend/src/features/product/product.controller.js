import ProductModel from './product.model.js';
import ProductRepository from './product.repository.js';

export default class ProductController {

  constructor(){
    this.productRepository = new ProductRepository();
  }

  // GET /api/products?q=shirt&category=mens&size=M,L&color=black&minPrice=500&maxPrice=3000&sort=price_asc&page=2&limit=12
  async getAllProducts(req, res) {
    try{
      // everything in req.query is a string, so clean it up before it reaches the database
      const text = (value) => (typeof value === "string" ? value.trim() : "");
      const number = (value) => {
        const n = Number(value);
        return text(value) !== "" && Number.isFinite(n) && n >= 0 ? n : null;
      };
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      // capped, so nobody can ask for 100000 products in one request
      const limit = Math.min(48, Math.max(1, parseInt(req.query.limit, 10) || 12));

      const result = await this.productRepository.getAll({
        q: text(req.query.q),
        category: text(req.query.category),
        categoryId: text(req.query.categoryId),
        size: text(req.query.size),
        color: text(req.query.color),
        minPrice: number(req.query.minPrice),
        maxPrice: number(req.query.maxPrice),
        onSale: req.query.onSale === "true",
        exclude: text(req.query.exclude),
        sort: text(req.query.sort),
        page,
        limit,
      });
      // data = { items, total, page, pages, limit }
      return res.status(200).json(
        {success:true,message:"Products fetched successfully", data:result}
      );
    }catch(err){
      console.log(err);
      return res.status(500).json({success:false,message:"Something went wrong"});
    }
  }

  // GET /api/products/filter-options
  async getFilterOptions(req, res) {
    try{
      const options = await this.productRepository.getFilterOptions();
      return res.status(200).json({success:true,message:"Filter options fetched successfully", data:options});
    }catch(err){
      console.log(err);
      return res.status(500).json({success:false,message:"Something went wrong"});
    }
  }

  async addProduct(req, res) {
    try{
      console.log(req.body);
      
    // const { name, price, sizes, categories } = req.body;
    // const newProduct = new ProductModel(name,null, parseFloat(price),
    // req.file.filename,categories, sizes.split(',')
    // );
    const createdProduct = await this.productRepository.add(req.body);
   return  res.status(201).json({success:true,message:"Product added successfully", data:createdProduct});
  }catch(err){
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
  }


  async getOneProduct(req, res) {
    try{
      const id = req.params.id;
      const product = await this.productRepository.get(id);
      if (!product) {
        return res.status(404).json({success:false,message:"Product not found"});
      } else {
        return res.status(200).json({success:true,message:"Product fetched successfully", data:product});
      }
    }catch(err){
    console.log(err);
    return res.status(200).json({success:false,message:"Something went wrong"});
  }
}

  async filterProducts(req, res) {
    try{  
    const minPrice = req.query.minPrice;
    const maxPrice = req.query.maxPrice;
    const categories = req.query.categories;
    const result = await this.productRepository.filter(
      minPrice,
      categories
    );
    res.status(200).json({success:true,message:"Products filtered successfully", data:result});
  }catch(err){
    console.log(err);
    return res.status(200).json({success:false,message:"Something went wrong"});
  }
  }

  async averagePrice(req, res, next){
    try{
      const result =await this.productRepository.averageProductPricePerCategory();
      res.status(200).json({success:true,message:"Average prices fetched successfully", data:result});
    }catch(err){
    console.log(err);
    return res.status(200).json({success:false,message:"Something went wrong"});
  }
  }
}
