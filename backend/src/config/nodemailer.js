import "dotenv/config"
import nodemailer from "nodemailer"

// one connection to Gmail, reused for every email
export const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.GMAIL,
        pass: process.env.APP_Password,
    },
})

// sendEmail({ to, subject, html, replyTo? }) -> sends one email from the shop's Gmail
// replyTo: where "Reply" in the inbox goes (e.g. the customer who wrote in)
export const sendEmail = ({ to, subject, html, replyTo }) => {
    return transporter.sendMail({
        from: `"Fashion Bazar" <${process.env.GMAIL}>`,
        to,
        subject,
        html,
        replyTo,
    })
}
