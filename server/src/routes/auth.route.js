import { Router } from 'express';
import { authControllers } from '../controllers/auth.controller.js';

const authRouter = Router();

/**
 * POST /api/auth/register
 * @description register all the users , stores the hashrefreshToken in session & refreshToken in cookies
 */

/**
 * POST /api/auth/login
 * @description login the user with refreshToken , starts a new sessions & return accessToken in res 
 */

/**
 * POST /api/auth/logout
 * @description logout from the device and set revoke : true
 */

authRouter.post('/register', authControllers.registerController);
authRouter.post('/login', authControllers.loginController);
authRouter.post('/refresh-token',authControllers.refreshTokenController);
authRouter.get('/logout', authControllers.logoutController);
authRouter.get('/logoutAll', authControllers.logoutAllController);
authRouter.post('/verify-email',authControllers.verifyEmailController);

export default authRouter;
