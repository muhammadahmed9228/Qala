import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { User } from "../auth/user.model.js"; 
import { getPagination } from "../../utils/pagination.js";

export const getAllCustomers = asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPagination(req.query, { defaultLimit: 10 });
    const filter = { role: "customer" };

    // Fetch only users with the 'customer' role
    const [customers, total] = await Promise.all([
        User.find(filter)
        .select("-password -refreshToken -refreshTokenHash -forgotPasswordToken -forgotPasswordExpiry")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
        User.countDocuments(filter)
    ]);

    return res.status(200).json(new ApiResponse(200, {
        customers,
        total,
        page,
        pages: Math.ceil(total / limit)
    }, "Customers fetched successfully"));
});
