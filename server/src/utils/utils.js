function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000);
}

function getotpHTML(otp) {
    return `
        <h1>OTP for your account verification is ${otp}</h1>
        <p>This OTP is valid for 10 minutes.</p>
    `;
}

export { generateOTP, getotpHTML };