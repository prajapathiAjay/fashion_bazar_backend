import jwt from 'jsonwebtoken';
import UserRepository from './user.repository.js';
import bcrypt from 'bcrypt';
import { getJwtSecret } from '../../config/jwtSecret.js';
import { ApplicationError } from '../../error-handler/applicationError.js';

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
      firstName,
      lastName,
      email,
      password,
   
    } = req.body;
    try {

      const hashedPassword = await bcrypt.hash(password, 12)
      const user = {
        firstName,
        lastName,
        email,
        password: hashedPassword,
      
      };
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
            getJwtSecret(),
            {
              expiresIn: '7d',
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
  async adminSignIn(req, res, next) {
    try {
      const { email, password } = req.body;

      // 1. Find the user, only if they are an admin.
      const user = await this.userRepository.findAdminByEmail(email);

      // 2. Same message whether the email is wrong, not an admin, or the password is wrong,
      //    so nobody can find out which admin emails exist.
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res
          .status(400)
          .json({ success: false, message: 'Incorrect Credentials' });
      }

      // 3. Create token.
      const token = jwt.sign(
        {
          userID: user._id,
          email: user.email,
        },
        getJwtSecret(),
        {
          expiresIn: '1d',
        }
      );

      // 4. Send token.
      return res.status(200).json({ success: true, message: 'Sign in successful', data: { token } });
    } catch (err) {
      console.log(err);
      return res.status(500).json({ success: false, message: 'Something went wrong' });
    }
  }


  async getUser(req, res, next) {

    const userID = req.userID;

    try {
      const user = await this.userRepository.getUserById(userID);
      res.status(200).json({ success: true, message: 'User fetched successfully', data: { user } })
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message })

    }


  }


  async updateUser(req, res, next) {
    const data = req.body
     const userID = req.userID;

 console.log("userId",userID)
    try {
      const updatedUser = await this.userRepository.updateUser(userID,data)
      res.status(200).json({ success: true, message: "user updated Succesfully" })

    } catch (error) {
      return res.status(500).json({ success: false, message: error.message })
    }


  }




  // ---------- Admin (view only) ----------

  // GET /api/admin/customers
  async getAllCustomers(req, res, next) {
    try {
      const customers = await this.userRepository.getAllCustomers();
      return res.status(200).json({ success: true, data: customers });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ success: false, message: "Could not load customers" });
    }
  }

  // GET /api/admin/customers/:id
  async getCustomerById(req, res, next) {
    try {
      const customer = await this.userRepository.getCustomerById(req.params.id);
      return res.status(200).json({ success: true, data: customer });
    } catch (error) {
      const status = error instanceof ApplicationError ? error.code : 500;
      if (status === 500) console.log(error);
      return res.status(status).json({
        success: false,
        message: status === 500 ? "Could not load the customer" : error.message,
      });
    }
  }
}




