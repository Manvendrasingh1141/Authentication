import mongoose from "mongoose";

const otpSchema = new mongoose.Schema({
    user:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"users",
        required:[true,"user is required"]
    },
    otp:{
        type:String,
        required:[true,"otp is required"]
    },
    expiresAt:{
        type:Date,
        required:[true,"expiresAt is required"]
    }
},
    {
        timestamps:true
    }
);

const otpModel = mongoose.model("otps",otpSchema);

export default otpModel;