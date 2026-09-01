import { Router } from "express";
import { authControllers } from "../controllers/auth.controller.js";
const googleRouter = Router();



/**
 * POST /api/auth/google
 */
googleRouter.post("/google",authControllers.googleController);

export default googleRouter