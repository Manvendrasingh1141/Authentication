import config from "../config/config.js";
import { OAuth2Client } from "google-auth-library";

const googleClient = new OAuth2Client(
    config.GOOGLE_CLIENT_ID
)

export default googleClient