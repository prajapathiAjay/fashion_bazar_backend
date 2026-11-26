import jwt from 'jsonwebtoken';
import UserRepository from './user.repository.js';
import bcrypt from 'bcrypt';
import { getJwtSecret } from '../../config/jwtSecret.js';
import { ApplicationError } from '../../error-handler/applicationError.js';
import crypto from 'crypto';
import { sendEmail } from '../../config/nodemailer.js';
import { resetPasswordEmail } from '../../helper/resetPasswordEmail.js';

// how long a reset link works
const RESET_LINK_MINUTES = 15;

// the token in the link is never stored; only this hash of it is
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export default class UserController {

  constructor() {
    this.userRepository = new UserRepository();
  }

  // POST /api/users/forgot-password   body: { email }
  // Emails a reset link. Replies the same way whether the account exists or not,
  // so nobody can use this form to find out which emails are registered.
  async forgotPassword(req, res) {
    const sameReply = {
      success: true,
      message: "If an account exists for this email, we've sent a reset link.",
    };
    try {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
      if (!email) {
        return res.status(400).json({ success: false, message: 'Enter the email you signed up with.' });
      }

      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        return res.status(200).json(sameReply);
      }

      // 1. random token for the link; the database only keeps its hash
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + RESET_LINK_MINUTES * 60 * 1000);
      await this.userRepository.saveResetToken(user._id, hashToken(token), expires);

      // 2. email the link (with the plain token)
      const link = `${process.env.CLIENT_URL}/reset-password/${token}`;
      try {
        await sendEmail({
          to: user.email,
          subject: 'Reset your Fashion Bazar password',
          html: resetPasswordEmail(user.firstName, link),
        });
      } catch (mailErr) {
        console.log(mailErr);
        // the email never arrived, so don't leave a working token behind
        await this.userRepository.clearResetToken(user._id);
        return res.status(500).json({ success: false, message: 'Could not send the email. Please try again.' });
      }

      return res.status(200).json(sameReply);
    } catch (err) {
      console.log(err);
      return res.status(500).json({ success: false, message: 'Something went wrong' });
    }
  }

  // POST /api/users/reset-password   body: { token, password }
  // Opened from the email link. Sets the new password if the token is valid and not expired.
  async resetPasswordWithToken(req, res) {
    try {
      const token = typeof req.body?.token === 'string' ? req.body.token : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';

      // same rules as the website's form (never trust only the browser)
      if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters and include a letter and a number.',
        });
      }
      if (!token) {
        return res.status(400).json({ success: false, message: 'This link is invalid or has expired.' });
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const user = await this.userRepository.resetPasswordWithToken(hashToken(token), hashedPassword);
      if (!user) {
        return res.status(400).json({ success: false, message: 'This link is invalid or has expired.' });
      }

      return res.status(200).json({ success: true, message: 'Password updated. You can now log in.' });
    } catch (err) {
      console.log(err);
      return res.status(500).json({ success: false, message: 'Something went wrong' });
    }
  }

  // PUT /api/users/resetPassword   body: { currentPassword, newPassword }
  // Change password while logged in. The current password must be correct,
  // so someone holding an unlocked device/token can't take over the account.
  async resetPassword(req, res, next) {
    try {
      const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
      const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

      if (!currentPassword) {
        return res.status(400).json({ success: false, message: 'Enter your current password.' });
      }
      // same rules as the website's form (never trust only the browser)
      if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters and include a letter and a number.',
        });
      }

      const user = await this.userRepository.findByIdWithPassword(req.userID);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      // 400, not 401: the website logs the user out on any 401
      const matches = await bcrypt.compare(currentPassword, user.password);
      if (!matches) {
        return res.status(400).json({ success: false, message: 'Your current password is incorrect.' });
      }
      if (await bcrypt.compare(newPassword, user.password)) {
        return res.status(400).json({ success: false, message: 'New password must be different from the current one.' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12);
      await this.userRepository.resetPassword(req.userID, hashedPassword);

      // Changing the password ends every older login (see jwtAuth), including this one,
      // so hand back a fresh token: the person who just changed it stays signed in here.
      const token = jwt.sign(
        { userID: user._id, email: user.email },
        getJwtSecret(),
        { expiresIn: user.type === 'admin' ? '1d' : '7d' } // same as their sign-in
      );
      res.status(200).json({ success: true, message: 'Password is updated', data: { token } });
    } catch (err) {
      console.log(err);
      console.log("Passing error to middleware");
      next(err);
    }
  }

  async signUp(req, res, next) {
    const firstName = typeof req.body?.firstName === 'string' ? req.body.firstName.trim() : '';
    const lastName = typeof req.body?.lastName === 'string' ? req.body.lastName.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    try {
      // same rules as reset / change password (never trust only the browser)
      if (!firstName) return res.status(400).json({ success: false, message: 'Please enter your first name.' });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
      }
      if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters and include a letter and a number.',
        });
      }
      // emails are unique ignoring case: Ravi@x.com and ravi@x.com are the same person
      if (await this.userRepository.findByEmail(email)) {
        return res.status(400).json({ success: false, message: 'An account with this email already exists. Please log in.' });
      }

      const hashedPassword = await bcrypt.hash(password, 12)
      const user = {
        firstName,
        lastName,
        email,
        password: hashedPassword,
      };
      await this.userRepository.signUp(user);
      // never send the password hash back to the browser
      res.status(201).json({ success: true, message: 'Sign up successful', data: { user: { firstName, lastName, email } } });
    } catch (err) {
      if (err instanceof ApplicationError) {
        return res.status(err.code).json({ success: false, message: err.message });
      }
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
        const result = await bcrypt.compare(String(req.body.password ?? ''), user.password || '');
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
    // Only copy the fields a user may edit on their own profile.
    // Never pass req.body straight through: someone could send { type: "admin" }
    // and make themselves an admin, or overwrite password / reset-token fields.
    const EDITABLE = ['firstName', 'lastName', 'email', 'phone', 'dob', 'addresses'];
    const data = {};
    for (const key of EDITABLE) {
      if (req.body?.[key] !== undefined) data[key] = req.body[key];
    }
    const userID = req.userID;

    try {
      if (data.email !== undefined) {
        data.email = String(data.email).trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
          return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
        }
      }
      // phone is optional on the profile, but if given it must be a 10-digit Indian mobile
      if (data.phone !== undefined && String(data.phone).trim() !== '') {
        const digits = String(data.phone).replace(/\D/g, '').slice(-10);
        if (!/^[6-9]\d{9}$/.test(digits)) {
          return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit mobile number.' });
        }
        data.phone = digits;
      }
      const updatedUser = await this.userRepository.updateUser(userID,data)
      res.status(200).json({ success: true, message: "user updated Succesfully" })

    } catch (error) {
      return res.status(error.code || 500).json({ success: false, message: error.message })
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




