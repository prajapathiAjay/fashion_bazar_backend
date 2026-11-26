// Load .env FIRST: some config files (cloudinary, razorpay) read process.env as soon as they're imported
import 'dotenv/config';
// 1. Import Exprerss
import express from 'express';
import swagger from 'swagger-ui-express';
import { getJwtSecret } from './src/config/jwtSecret.js';

import productRouter from './src/features/product/product.routes.js';
import userRouter from './src/features/user/user.routes.js';
import jwtAuth from './src/middlewares/jwt.middleware.js';
import cartRouter from './src/features/cartItems/cartItems.routes.js';
import apiDocs from './swagger.json' with { type: 'json' };
import loggerMiddleware from './src/middlewares/logger.middleware.js';
import { ApplicationError } from './src/error-handler/applicationError.js';
import orderRouter from './src/features/order/order.routes.js';
import razorpayWebhookRouter from './src/features/order/razorpayWebhook.routes.js';
import orderAdminRouter from './src/features/order/order.admin.routes.js';
import customerAdminRouter from './src/features/user/user.admin.routes.js';
import discountAdminRouter from './src/features/discount/discount.admin.routes.js';
import discountRouter from './src/features/discount/discount.routes.js';
import { shippingRouter, shippingAdminRouter } from './src/features/shipping/shipping.routes.js';
import reviewAdminRouter from './src/features/review/review.admin.routes.js';
import { isAdmin } from './src/middlewares/IsAdmin.js';
import { connectUsingMongoose } from './src/config/mongooseConfig.js';
import mongoose from 'mongoose';
import categoryRouter from './src/features/category/category.routes.js';
import wishListRouter from './src/features/wishlist/wishlist.routes.js';
import uploadRouter from './src/features/upload/upload.routes.js';
import reviewRouter from './src/features/review/review.routes.js';
import contactRouter from './src/features/contact/contact.routes.js';
import contactAdminRouter from './src/features/contact/contact.admin.routes.js';
import { faqRouter, faqAdminRouter } from './src/features/faq/faq.routes.js';
import { settingsRouter, settingsAdminRouter } from './src/features/settings/settings.routes.js';
import statsAdminRouter from './src/features/stats/stats.routes.js';
// 2. Create Server
const server = express();

// Stop right away if the login-token key is missing, instead of failing on the first sign-in
getJwtSecret();

// CORS: only the website and admin panel addresses in ALLOWED_ORIGINS (.env, comma separated) may call the API
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim());
server.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  }
  // '*' doesn't cover Authorization in browsers, so list it explicitly
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', '*');
  // return ok for preflight request.
  if (req.method == 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Also keep the exact request bytes: the Razorpay webhook signature is checked against them
server.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  },
}));
// Bearer <token>
// for all requests related to product, redirect to product routes.
// localhost:3200/api/products
server.use(
  '/api-docs',
  swagger.serve,
  swagger.setup(apiDocs)
);


server.use(loggerMiddleware);
// Called by Razorpay's servers, so no jwtAuth (checked by signature instead)
server.use('/api/razorpay/webhook', razorpayWebhookRouter);
server.use('/api/orders',
   jwtAuth,
    orderRouter);
// Admin panel: view all orders (logged in + type "admin" only)
server.use('/api/admin/orders',
  jwtAuth,
  isAdmin,
  orderAdminRouter);
// Admin panel: view customers (logged in + type "admin" only)
server.use('/api/admin/customers',
  jwtAuth,
  isAdmin,
  customerAdminRouter);
// Admin panel: coupon codes (logged in + type "admin" only)
server.use('/api/admin/discounts',
  jwtAuth,
  isAdmin,
  discountAdminRouter);
// Shoppers: check a coupon at checkout
server.use('/api/discounts',
  jwtAuth,
  discountRouter);
// Admin panel: delivery rates
server.use('/api/admin/shipping',
  jwtAuth,
  isAdmin,
  shippingAdminRouter);
// Admin panel: review moderation
server.use('/api/admin/reviews',
  jwtAuth,
  isAdmin,
  reviewAdminRouter);
// Admin panel: Contact page messages (read / resolve / delete)
server.use('/api/admin/messages',
  jwtAuth,
  isAdmin,
  contactAdminRouter);
// Admin panel: Help centre questions (add / edit / publish / delete)
server.use('/api/admin/faqs',
  jwtAuth,
  isAdmin,
  faqAdminRouter);
// Admin panel: store name and contact details
server.use('/api/admin/settings',
  jwtAuth,
  isAdmin,
  settingsAdminRouter);
// Admin panel: Dashboard + Analytics numbers worked out from real orders
server.use('/api/admin/stats',
  jwtAuth,
  isAdmin,
  statsAdminRouter);
// Public: store name and contact details for the website's footer / Contact page
server.use('/api/settings', settingsRouter);
// Public: published FAQs for the website's Help centre
server.use('/api/faq', faqRouter);
// Public: current delivery rates for cart / checkout
server.use('/api/shipping', shippingRouter);

server.use(
  '/api/products',
  // jwtAuth,
  productRouter
);
server.use("/api/wishlist",
  jwtAuth,
  wishListRouter
)
server.use("/api/category",categoryRouter)
server.use("/api/upload",
  // jwtAuth,
  uploadRouter)
server.use(
  '/api/cartItems',
  loggerMiddleware,
  jwtAuth,
  cartRouter
);
server.use('/api/users', userRouter);

server.use("/api/review",reviewRouter)
server.use("/api/contact",contactRouter)





// 3. Default request handler
server.get('/', (req, res) => {
  res.send('Welcome to Ecommerce APIs');
});

// Error handler middleware
// Always answers { success: false, message } (JSON), so the website and admin panel can read the message
server.use((err, req, res, next) => {
  console.log(err);
  if(err instanceof mongoose.Error.ValidationError){
    const first = Object.values(err.errors)[0]?.message;
    return res.status(400).json({ success: false, message: first || 'Please check the details and try again' });
  }
  if (err instanceof ApplicationError) {
    return res.status(err.code).json({ success: false, message: err.message });
  }
  // image uploads (multer): too many files / too big
  if (err?.name === 'MulterError') {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'Each image must be 10 MB or smaller'
      : err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT'
        ? 'Too many images in one upload (5 at most)'
        : 'Could not upload the images';
    return res.status(400).json({ success: false, message });
  }
  // body that isn't valid JSON
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Invalid request' });
  }

  // server errors.
  res.status(500).json({ success: false, message: 'Something went wrong, please try later' });
});

// 4. Middleware to handle 404 requests.
server.use((req, res) => {
  res
    .status(404)
    .send(
      'API not found. Please check our documentation for more information at localhost:3200/api-docs'
    );
});

// 5. Specify port.
// hosting platforms (Render, Railway...) give the port in PORT
const PORT = Number(process.env.PORT) || 3200;
server.listen(PORT, ()=>{
  console.log(`Server is running at ${PORT}`);
  connectUsingMongoose();
});

