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

// sendEmail({ to, subject, html }) -> sends one email from the shop's Gmail
export const sendEmail = ({ to, subject, html }) => {
    return transporter.sendMail({
        from: `"Fashion Bazar" <${process.env.GMAIL}>`,
        to,
        subject,
        html,
    })
}
