// One-time: fills the FAQ collection with the questions the website used to have hardcoded.
// Run from the backend folder:  npm run seed:faqs
// Safe to run again: it does nothing if any FAQ already exists.
import "dotenv/config"
import mongoose from "mongoose"
import { FaqModel } from "../src/features/faq/faq.schema.js"

const STARTER_FAQS = [
  // Orders & payment
  { topic: "Orders & payment", question: "How do I track my order?", answer: "Go to Account → Orders and open the order. You'll see its status and the courier tracking link once it ships." },
  { topic: "Orders & payment", question: "Which payment methods do you accept?", answer: "UPI, RuPay, Visa, Mastercard, net banking and cash on delivery (on eligible orders)." },
  { topic: "Orders & payment", question: "Can I order from more than one seller at once?", answer: "Yes. Add items from any sellers to one cart and pay once. Items from different sellers may arrive in separate parcels." },
  { topic: "Orders & payment", question: "Can I cancel my order?", answer: "You can cancel from Account → Orders any time before the seller ships it. Your refund starts right away." },
  // Shipping & returns
  { topic: "Shipping & returns", question: "How much is delivery?", answer: "Delivery is free on orders over ₹999. Below that, a small delivery fee is shown at checkout." },
  { topic: "Shipping & returns", question: "How long does delivery take?", answer: "Most orders arrive in 3–7 working days, depending on your city and the seller's location." },
  { topic: "Shipping & returns", question: "What is your return policy?", answer: "You can return most items within 30 days of delivery if they're unused and have their tags on. Start a return from Account → Orders." },
  { topic: "Shipping & returns", question: "When will I get my refund?", answer: "Once the seller receives your return, refunds reach UPI and cards in 5–7 working days. Cash on delivery orders are refunded to your bank account." },
  // Selling on Fashion Bazar
  { topic: "Selling on Fashion Bazar", question: "How much does it cost to sell?", answer: "There's no listing fee or monthly charge. We take a flat 10% commission on each sale, so you keep 90%." },
  { topic: "Selling on Fashion Bazar", question: "When do sellers get paid?", answer: "Payouts go to your bank account every week for all delivered orders that are past the return window." },
  { topic: "Selling on Fashion Bazar", question: "Do I need a GSTIN to sell?", answer: "Only if your turnover is above the GST registration limit. A PAN card and bank account are enough to start." },
  // Account
  { topic: "Account", question: "How do I reset my password?", answer: "On the sign-in page, choose \"Forgot password\" and enter your email address. We'll send you a link to set a new one." },
  { topic: "Account", question: "How do I change my delivery address?", answer: "Go to Account → Addresses to add or remove an address. You can also pick a different address at checkout." },
]

try {
  await mongoose.connect(process.env.DB_URL)
  const existing = await FaqModel.countDocuments()
  if (existing > 0) {
    console.log(`FAQ collection already has ${existing} questions, nothing added.`)
  } else {
    // one at a time so createdAt keeps this order (the website lists oldest first)
    for (const faq of STARTER_FAQS) {
      await FaqModel.create({ ...faq, isPublished: true })
    }
    console.log(`Added ${STARTER_FAQS.length} FAQs (all published).`)
  }
} catch (err) {
  console.log("Seeding FAQs failed:", err)
  process.exitCode = 1
} finally {
  await mongoose.disconnect()
}
