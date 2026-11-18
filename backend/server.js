import connectDB from "./src/config/db.js";
import { app } from "./src/app.js";

const PORT = process.env.PORT || 6000;

const startServer = async () => {
    try {
        await connectDB();

        app.listen(PORT, () => {
            console.log(`Server is running at port : ${PORT}`);
        });
    } catch (error) {
        console.error("Server startup aborted: MongoDB connection failed", error);
        process.exitCode = 1;
    }
};

startServer();
