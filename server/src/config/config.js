import dotenv from 'dotenv';
dotenv.config();

if(!process.env.PORT){
        throw new Error('PORT is missing in environmental variables');
}

if(!process.env.MONGO_URI){
        throw new Error('MONGO_URI is missing in environmental variables');
}

if(!process.env.JWT_SECRET){
        throw new Error('JWT_SECRET is missing in environmental variables');
}



const config = {
    PORT : process.env.PORT,
    MONGO_URI : process.env.MONGO_URI,
    JWT_SECRET : process.env.JWT_SECRET,
    GOOGLE_CLIENT_ID : process.env.GOOGLE_CLIENT_ID,
    GOOGLE_SECRET_ID : process.env.GOOGLE_SECRET_ID,
    GOOGLE_USER : process.env.GOOGLE_USER
}


export default config