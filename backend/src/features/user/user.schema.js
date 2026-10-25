import mongoose from "mongoose";

export const userSchema = new mongoose.Schema({
    firstName: { type: String, maxLength:[25, "Name can't be greater than 25 characters"]},
    lastName:{type:String},
   email: {
  type: String,
  unique: true,
  required: true,
//   match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please enter a valid email"]
},
    password: {type: String, 
        // validate:{
        //     validator: function(value){
        //         return /^(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,12}$/.test(value)
        //     },
        //     message:"Password should be between 8-12 charachetrs and have a special character"
        // }
    },
    phone:{type:Number},
    dob:{type:String},
    Address:{type:Array},
    type:{ type: String, enum: ['Customer', 'Seller']}
}, { timestamps: true })