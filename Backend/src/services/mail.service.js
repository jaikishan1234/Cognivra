// Nodemailer Setup
// import nodemailer from "nodemailer";

// const transporter = nodemailer.createTransport({
//     service: "gmail",
//     auth: {
//         type: 'OAuth2',
//         user: process.env.GOOGLE_USER,
//         clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//         refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
//         clientId: process.env.GOOGLE_CLIENT_ID
//     }
// })

// transporter.verify()
//     .then(() => { console.log("Email transporter is ready to send emails"); })
//     .catch((err) => { console.error("Email transporter verification failed:", err); });


// export async function sendEmail({ to, subject, html, text }) {

//     const mailOptions = {
//         from: process.env.GOOGLE_USER,
//         to,
//         subject,
//         html,
//         text
//     };

//     const details = await transporter.sendMail(mailOptions);
//     console.log("Email sent:", details);
// }


// Resend For the production
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail({ to, subject, html, text }) {
    const { data, error } = await resend.emails.send({
        from: "Cognivra <onboarding@resend.dev>", // swap to your verified domain later, e.g. "Cognivra <hello@cognivra.com>"
        to,
        subject,
        html,
        text,
    });

    if (error) {
        console.error("Resend error:", error);
        throw new Error(error.message || "Failed to send email");
    }

    console.log("Email sent:", data);
    return data;
}