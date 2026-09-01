import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from "../config/config.js";
import userModel from "../models/user.model.js";
import sessionModel from "../models/session.model.js";
import googleClient from '../services/google.service.js';
import {sendEmail} from '../services/email.service.js';
import { generateOTP,getotpHTML } from '../utils/utils.js';
import otpModel from '../models/otp.model.js';



const registerController = async(req,res)=>{
    try{
        const {username,email,password} = req.body;
        const isAlreadyRegisteredEmail = await userModel.findOne({
            $or:[
                {username},
                {email}
            ]
        });

        if(isAlreadyRegisteredEmail){
            return res.status(409).json({message:"User already registered"});
        }
        const hashedpassword = crypto.createHash('sha256').update(password).digest('hex');
        const user = await userModel.create({
            username,
            email,
            password:hashedpassword
        });
        
        const otp = generateOTP();
        console.log(otp);
        const html = getotpHTML(otp);
        const otpHash = crypto.createHash('sha256').update(otp.toString()).digest('hex');
        await otpModel.create({
            user:user._id,
            otp:otpHash,
            expiresAt:new Date(Date.now() + 10 * 60 * 1000)
        });

        await sendEmail(email,"OTP Verification",`Your OTP is ${otp}`,html);


        return res.status(201).json({
            message:"User registered successfully",
            data : [
                user.username,
                user.email,
                user.verified
            ]
        });

    }catch(err){
        console.log(err);
        return res.status(401).json({error:err});
    }
}

const loginController = async(req,res)=>{
  try{
    const {email,password} = req.body;
    console.log(email);
    const registeredUser = await userModel.findOne({email});
    console.log(registeredUser)
    if(!registeredUser){
      return res.status(401).json({
        message:"Email is not Registered"});
    }

    if(!registeredUser.verified){
      return res.status(401).json({
        message:"Email is not verified"});
    }

    const hashedpassword = crypto.createHash('sha256').update(password).digest("hex");
    const validPassword = hashedpassword === registeredUser.password;

    if(!validPassword){
      return res.status(401).json({message:"Incorrect password"});
    }

    const refreshToken = jwt.sign({
      id:registeredUser._id
    },config.JWT_SECRET,
    {
      expiresIn:"7d"
    });

    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest("hex");
    const session = await sessionModel.create({
      user:registeredUser._id,
      refreshTokenHash,
      ip:req.ip,
      userAgent:req.headers["user-agent"]
    })

    res.cookie("refreshToken",refreshToken,{
      httpOnly:true,
      secure:false,
      sameSite:"strict",
      maxAge:7*24*60*60*1000
    })



    const accessToken = jwt.sign({
      id:registeredUser._id,
      sessionId:session._id
    },config.JWT_SECRET,
    {
      expiresIn:"10m"
    });

    res.status(201).json({
      message:"User Loggedin SuccessFully",
      toke:accessToken
    })
  }
  catch{
    return res.status(401).json({
      message:"Unable to login"
    })
  }
}

const refreshTokenController = async(req,res)=>{
  try{
    const refreshToken = req.cookies.refreshToken || req.headers.authorization?.split(" ")[1];

    if(!refreshToken){
        return res.status(400).json({
            message:"refreshToken is required"
        })
      }
    const decoded = jwt.verify(refreshToken,config.JWT_SECRET);
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const session = await sessionModel.findOne({
      refreshTokenHash,
      revoked:false
    })

    if(!session){
      return res.status(401).json({
        message:"Invalid refresh token"
      })
    }


    const newrefreshToken = jwt.sign({
            id:decoded.id
            },
            config.JWT_SECRET,
            {
                expiresIn : "7d"
            });

    res.cookie('refreshToken', newrefreshToken, {
        httpOnly: true,     // Prevents JavaScript from accessing the cookie (security)
        secure: false,      // Set to true if you are using HTTPS in production
        sameSite: 'strict', // CSRF protection
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
        });

    const newrefreshTokenHash = crypto.createHash('sha256').update(newrefreshToken).digest('hex');
    session.refreshTokenHash = newrefreshTokenHash;
    await session.save();
    
    const accessToken = jwt.sign({
            id:decoded.id,
            sessionId:session._id
            },
            config.JWT_SECRET,
            {
            expiresIn : "10m"
        });

        res.status(201).json({
            message:"accessToken generated successfully",
            token : accessToken
        })
      }catch(err){
        return res.status(401).json({ message:"Invalid or expired refresh token"});
      }
}

const logoutController = async(req,res)=>{
        const refreshToken = req.cookies?.refreshToken || req.headers.authorization?.split(" ")[1];
        if(!refreshToken){
            return res.status(400).json({message:"Token is not found"});
        }

      try{
        const decoded = jwt.verify(refreshToken, config.JWT_SECRET);
        const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        const session = await sessionModel.findOne({
            refreshTokenHash,
            revoked:false
       })

        if(!session){
            return res.status(400).json({message:"Token is not found"});
        }

        session.revoked=true;
        await session.save();

        res.clearCookie("refreshToken")

        return res.status(200).json({message:"loggout successfully"});
     }catch(err){
        return res.status(401).json({ message:"Invalid or expired refresh token"});
      }
}

const logoutAllController = async(req,res)=>{
      try{
          const refreshToken = req.cookies?.refreshToken;
          if(!refreshToken){
            return res.status(401).json({
            message:"Token is not present"});
          }
        const decoded = jwt.verify(refreshToken,config.JWT_SECRET);
        await sessionModel.updateMany({
          user:decoded._id,
          revoked:false
        },{revoked:true});

        res.clearCookie("refreshToken");

        return res.status(200).json({
          message:"Logout successfully from all the devices"
        })
      }
      catch(err){
        return res.status(401).json({
          message:"Invalid token"
        })
   }
}

const googleController = async(req,res)=>{
    try{
      const {token} = req.body;

      const ticket = googleClient.verifyIdToken({
        idToken:token,
        audience:config.GOOGLE_CLIENT_ID
      })

      const payload = ticket.getPayload();
      const googleId = payload.sub;
      const email = payload.email;
      const username = payload.name;


      const user = await userModel.findOne({
            googleId
        });

      if(!user){
            user = await userModel.findOne({
                email
            });
        }

        if(!user){
            user = await userModel.create({
                username,
                email,
                googleId,
                provider:"google"
            });
        }

        const refreshToken = jwt.sign({
            id:user._id
        },
        config.JWT_SECRET,{
            expiresIn:"7d"
        });

        const refreshTokenHash = crypto
            .createHash("sha256")
            .update(refreshToken)
            .digest("hex");

        const session = await sessionModel.create({
            user:user._id,
            refreshTokenHash,
            ip:req.ip,
            userAgent:req.headers["user-agent"]
        });

        const accessToken = jwt.sign({
            id:user._id,
            sessionId:session._id
        },
        config.JWT_SECRET,{
            expiresIn:"10m"
        });

        res.cookie("refreshToken",refreshToken,{
            httpOnly:true,
            secure:false,
            sameSite:"strict",
            maxAge:7 * 24 * 60 * 60 * 1000
        });

        return res.status(200).json({
            message:"Google login successful",
            token:accessToken
        });
    }
    catch{
      return res.json(500).json({
        message:"Google Api server"
      })
    }
}

const verifyEmailController = async(req,res)=>{
    try{
        const {email,otp} = req.body;
        const otpHash = crypto.createHash('sha256').update(otp.toString()).digest('hex');

        const otpRecord = await otpModel.findOne({
            otp:otpHash,
            expiresAt:{$gt:new Date()}
        });
        if(!otpRecord){
            return res.status(400).json({
                message:"Invalid or expired OTP"
            })
        }

        const user = await userModel.findByIdAndUpdate(otpRecord.user,
          {
            verified:true
          });

        await otpModel.deleteMany({user:otpRecord.user});

        return res.status(200).json({
            message:"Email verified successfully"
        })
      }
      catch(err){
        return res.status(400).json({
            message:"Invalid or expired OTP"
        })
      }
}

export const authControllers = {
    registerController,
    loginController,
    refreshTokenController,
    logoutController,
    logoutAllController,
    googleController,
    verifyEmailController
}
