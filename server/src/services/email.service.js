import config from "../config/config.js";
import nodemailer from 'nodemailer';


const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        type: 'OAuth2',
        user: config.EMAIL_ADDRESS,
        clientId: config.GOOGLE_CLIENT_ID,
        clientSecret: config.GOOGLE_CLIENT_SECRET,
        refreshToken: config.GOOGLE_REFRESH_TOKEN
    }
})

transporter.verify((error, success) => {
    if (error) {
        console.log(error);
    } else {
        console.log('Server is ready to take our messages');
    }
});

 export const sendEmail = async (to, subject, text, html) => {
    try{
        const info = await transporter.sendMail({
            from: config.EMAIL_USER,
            to,
            subject,
            text,
            html
        });
        console.log('Email sent: ' + info.response);    
    } catch (error) {
        console.error('Error sending email: ' + error);
    }
}