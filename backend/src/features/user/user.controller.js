import UserModel from './user.model.js';
import jwt from 'jsonwebtoken';
import UserRepository from './user.repository.js';
import bcrypt from 'bcrypt';

export default class UserController {

  constructor() {
    this.userRepository = new UserRepository();
  }

  async resetPassword(req, res, next) {
    const { newPassword } = req.body;
    const hashedPassword = await bcrypt.hash(newPassword, 12)
    const userID = req.userID;
    try {
      await this.userRepository.resetPassword(userID, hashedPassword)
      res.status(200).json({ success: true, message: 'Password is updated' });
    } catch (err) {
      console.log(err);
      console.log("Passing error to middleware");
      next(err);
    }
  }

  async signUp(req, res, next) {
    const {
      name,
      email,
      password,
      type,
    } = req.body;
    try {

      const hashedPassword = await bcrypt.hash(password, 12)
      const user = new UserModel(
        name,
        email,
        hashedPassword,
        type
      );
      await this.userRepository.signUp(user);
      res.status(201).json({ success: true, message: 'Sign up successful', data: { user } });
    } catch (err) {
      next(err);
    }
  }

  async signIn(req, res, next) {
    try {
      // 1. Find user by email.
      const user = await this.userRepository.findByEmail(req.body.email);
      if (!user) {
        return res
          .status(400)
          .json({ success: false, message: 'Incorrect Credentials' });
      } else {
        // 2. Compare password with hashed password.
        const result = await bcrypt.compare(req.body.password, user.password);
        if (result) {
          // 3. Create token.
          const token = jwt.sign(
            {
              userID: user._id,
              email: user.email,
            },
            'AIb6d35fvJM4O9pXqXQNla2jBCH9kuLz',
            {
              expiresIn: '1h',
            }
          );
          // 4. Send token.
          return res.status(200).json({ success: true, message: 'Sign in successful', data: { token } });
        } else {
          return res
            .status(400)
            .json({ success: false, message: 'Incorrect Credentials' });
        }
      }
    } catch (err) {
      console.log(err);
      return res.status(500).json({ success: false, message: 'Something went wrong' });
    }
  }



  async getUser(req,res,next){

     const userID = req.userID;

     try{
      const user=await this.userRepository.getUserById(userID);
      res.status(200).json({success:true,message:'User fetched successfully',data:{user}})  
     }catch(error){
      return res.status(500).json({success:false,message:error.message})

     }


  }



}




