import app from "./src/app.js";
import config from "./src/config/config.js";
import { connectDB } from "./src/connections/database.js";


connectDB();
app.listen(config.PORT,()=>{
    console.log("Server is running...");
})