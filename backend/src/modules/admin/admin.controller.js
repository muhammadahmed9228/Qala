import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { Order } from "../orders/order.model.js";
import { User } from "../auth/user.model.js";
import { Product } from "../products/product.model.js";

export const getDashboardStats = asyncHandler(async (req, res) => {
    // Keep all dashboard metrics in one database round trip. The seed documents
    // make the lookup facet work even when there are no orders yet.
    const [dashboardAggregation] = await Order.aggregate([
        {
            $unionWith: {
                coll: User.collection.name,
                pipeline: [
                    { $limit: 1 },
                    { $project: { _dashboardSeed: { $literal: true } } }
                ]
            }
        },
        {
            $unionWith: {
                coll: Product.collection.name,
                pipeline: [
                    { $limit: 1 },
                    { $project: { _dashboardSeed: { $literal: true } } }
                ]
            }
        },
        {
            $facet: {
                orderStats: [
                    { $match: { orderNumber: { $exists: true } } },
                    {
                        $group: {
                            _id: null,
                            totalOrders: { $sum: 1 },
                            pendingOrders: { $sum: { $cond: [{ $eq: ["$status", "Pending"] }, 1, 0] } },
                            processingOrders: { $sum: { $cond: [{ $eq: ["$status", "Processing"] }, 1, 0] } },
                            deliveredOrders: { $sum: { $cond: [{ $eq: ["$status", "Delivered"] }, 1, 0] } },
                            cancelledOrders: { $sum: { $cond: [{ $eq: ["$status", "Cancelled"] }, 1, 0] } },
                            totalRevenue: {
                                $sum: {
                                    $cond: [
                                        { $eq: ["$status", "Delivered"] },
                                        { $ifNull: ["$pricing.total", 0] },
                                        0
                                    ]
                                }
                            }
                        }
                    }
                ],
                recentOrders: [
                    { $match: { orderNumber: { $exists: true } } },
                    { $sort: { createdAt: -1 } },
                    { $limit: 5 },
                    { $project: { orderNumber: 1, "customerInfo.name": 1, "pricing.total": 1, status: 1, createdAt: 1 } }
                ],
                entityStats: [
                    { $match: { _dashboardSeed: true } },
                    { $limit: 1 },
                    {
                        $lookup: {
                            from: User.collection.name,
                            pipeline: [
                                { $match: { role: "customer" } },
                                { $count: "count" }
                            ],
                            as: "customerCount"
                        }
                    },
                    {
                        $lookup: {
                            from: Product.collection.name,
                            pipeline: [{ $count: "count" }],
                            as: "productCount"
                        }
                    },
                    {
                        $project: {
                            customers: { $ifNull: [{ $arrayElemAt: ["$customerCount.count", 0] }, 0] },
                            products: { $ifNull: [{ $arrayElemAt: ["$productCount.count", 0] }, 0] }
                        }
                    }
                ]
            }
        }
    ]);

    const orderStats = dashboardAggregation?.orderStats?.[0] || {};
    const entityStats = dashboardAggregation?.entityStats?.[0] || {};
    const recentOrders = dashboardAggregation?.recentOrders || [];

    const dashboardData = {
        stats: {
            revenue: orderStats.totalRevenue || 0,
            customers: entityStats.customers || 0,
            products: entityStats.products || 0,
            orders: {
                total: orderStats.totalOrders || 0,
                pending: orderStats.pendingOrders || 0,
                processing: orderStats.processingOrders || 0,
                delivered: orderStats.deliveredOrders || 0,
                cancelled: orderStats.cancelledOrders || 0
            }
        },
        recentOrders
    };

    return res.status(200).json(new ApiResponse(200, dashboardData, "Dashboard stats fetched successfully"));
});
