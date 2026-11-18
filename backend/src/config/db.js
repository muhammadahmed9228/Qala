import mongoose from "mongoose";

const connectDB = async () => {
    const connectionInstance = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`\nMongoDB connected !! DB HOST: ${connectionInstance.connection.host}`);
    return connectionInstance;
};

export default connectDB;
