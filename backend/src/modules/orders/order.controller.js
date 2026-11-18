import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { Order } from "./order.model.js";
import { Product } from "../products/product.model.js";
import {
    sendOrderConfirmationEmail,
    sendAdminNewOrderNotification,
    sendOrderStatusEmail
} from "../../services/email.service.js";
import axios from "axios";
import { validateCoupon } from "../coupons/coupon.service.js";
import { getShippingOption, getShippingOptions as listShippingOptions } from "./shipping.config.js";
import { getPagination } from "../../utils/pagination.js";

export const getShippingOptions = asyncHandler(async (req, res) => {
    return res.status(200).json(new ApiResponse(200, listShippingOptions(), "Shipping options fetched successfully"));
});

export const createOrder = asyncHandler(async (req, res) => {
    const { customerInfo, shippingInfo, billingInfo, items, turnstileToken, couponCode, paymentMethod, termsAccepted, shippingMethod, idempotencyKey } = req.body;

    // Return an already-created order before re-validating a one-time Turnstile
    // token. This makes safe client retries possible after a network timeout.
    if (idempotencyKey) {
        const existingOrder = await Order.findOne({ idempotencyKey });
        if (existingOrder) {
            return res.status(200).json(new ApiResponse(200, existingOrder, "Order already placed"));
        }
    }

    if (!turnstileToken) {
        return res.status(400).json({ message: "Security token is missing." });
    }

    try {
        const turnstileRes = await axios.post("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
            secret: process.env.TURNSTILE_SECRET_KEY,
            response: turnstileToken
        });

        if (!turnstileRes.data.success) {
            return res.status(400).json({ message: "Security verification failed." });
        }
    } catch (error) {
        return res.status(400).json({ message: "Security verification failed." });
    }

    if (!items || items.length === 0) {
        throw new ApiError(400, "Order items cannot be empty");
    }
    if (!termsAccepted) {
        throw new ApiError(400, "Terms & Conditions must be accepted before placing an order");
    }
    if (!customerInfo?.name?.trim() || !customerInfo?.email?.trim() || !customerInfo?.phone?.trim()) {
        throw new ApiError(400, "Name, email, and phone are required");
    }
    if (!shippingInfo?.address?.trim() || !shippingInfo?.city?.trim()) {
        throw new ApiError(400, "A complete shipping address is required");
    }
    if (!billingInfo?.address?.trim() || !billingInfo?.city?.trim()) {
        throw new ApiError(400, "A complete billing address is required");
    }

    const selectedShipping = getShippingOption(shippingMethod?.code || shippingMethod || "flat_rate");
    if (!selectedShipping) {
        throw new ApiError(400, "Selected shipping method is not available");
    }

    let calculatedSubtotal = 0;
    const orderItemsSnapshot = [];
    const productIds = [...new Set(items.map((item) => String(item.productId)))];
    const products = await Product.find({ _id: { $in: productIds } });
    const productsById = new Map(products.map((product) => [product._id.toString(), product]));

    // 1. Authoritative Backend Price Calculation & Stock Verification
    for (const item of items) {
        const product = productsById.get(String(item.productId));
        if (!product) throw new ApiError(404, `Product ${item.name} not found`);

        const variant = product.variants.find(v => v.colorName === item.color);
        if (!variant) throw new ApiError(400, `Color ${item.color} invalid for ${product.name}`);

        let currentBasePrice = product.basePrice;

        // NEW: Check if CUSTOM size
        if (item.size === "CUSTOM") {
            if (!product.customSizing?.enabled) {
                throw new ApiError(400, `Custom sizing is not enabled for ${product.name}`);
            }
            // Add surcharge (Fulfils Enhancement 2: standard sizes have no extra price, only custom)
            currentBasePrice += (product.customSizing.surcharge || 0);
        } else {
            // Standard Size Logic
            const sizeObj = variant.sizes.find(s => s.sku === item.sku);
            if (!sizeObj) throw new ApiError(400, `SKU ${item.sku} invalid`);
            if (sizeObj.stock < item.quantity) {
                throw new ApiError(400, `Insufficient stock for ${product.name} (${item.size}). Available: ${sizeObj.stock}`);
            }
        }

        // Calculate authoritative price
        const finalUnitPrice = product.discount
            ? currentBasePrice - (currentBasePrice * (product.discount / 100))
            : currentBasePrice;

        calculatedSubtotal += finalUnitPrice * item.quantity;

        orderItemsSnapshot.push({
            productId: product._id,
            name: product.name,
            sku: item.sku,
            color: variant.colorName,
            size: item.size,
            quantity: item.quantity,
            unitPrice: finalUnitPrice,
            image: item.image,
            customMeasurements: item.customMeasurements || null // NEW: Save to DB
        });
    }

    let discountAmount = 0;
    let appliedCoupon = null;

    const normalizedCustomerEmail = customerInfo.email.trim().toLowerCase();

    if (couponCode) {
        try {
            // NEW: Enforce one-time use of coupon per email address
            const previousOrder = await Order.findOne({
                "customerInfo.email": normalizedCustomerEmail,
                "coupon.code": couponCode.toUpperCase(),
                status: { $ne: "Cancelled" }
            });

            if (previousOrder) {
                throw new ApiError(400, "You have already used this coupon code.");
            }

            const result = await validateCoupon(couponCode, calculatedSubtotal);
            discountAmount = result.discountAmount;
            appliedCoupon = {
                code: result.coupon.code,
                discountType: result.coupon.discountType,
                discountValue: result.coupon.discountValue,
                discountAmount: result.discountAmount
            };
        } catch (error) {
            throw new ApiError(400, `Coupon Error: ${error.message}`);
        }
    }

    const shippingCost = selectedShipping.cost;
    
    // NEW: Apply Rs 100 bank transfer discount
    if (paymentMethod === "BANK_TRANSFER") {
        discountAmount += 100;
    }

    const total = Math.max(0, calculatedSubtotal - discountAmount) + shippingCost;

    // 2. Atomic stock deduction and order creation. A conditional update prevents
    // concurrent checkouts from taking the same remaining units.
    const orderNumber = `Q-${Date.now().toString().slice(-6)}-${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;
    const deductedItems = [];
    let order;

    try {
        for (const item of orderItemsSnapshot) {
            if (item.size === "CUSTOM") {
                await Product.updateOne(
                    { _id: item.productId },
                    { $inc: { soldCount: item.quantity } }
                );
            } else {
                const result = await Product.updateOne(
                    {
                        _id: item.productId,
                        variants: {
                            $elemMatch: {
                                colorName: item.color,
                                sizes: { $elemMatch: { sku: item.sku, stock: { $gte: item.quantity } } }
                            }
                        }
                    },
                    {
                        $inc: {
                            "variants.$[v].sizes.$[s].stock": -item.quantity,
                            soldCount: item.quantity
                        }
                    },
                    { arrayFilters: [{ "v.colorName": item.color }, { "s.sku": item.sku }] }
                );
                if (result.modifiedCount !== 1) {
                    throw new ApiError(400, `Stock changed before checkout completed for ${item.name} (${item.size}). Please review your cart.`);
                }
            }
            deductedItems.push(item);
        }

        order = await Order.create({
            orderNumber,
            ...(idempotencyKey ? { idempotencyKey } : {}),
            userRef: req.user?._id || null,
            customerInfo: {
                name: customerInfo.name.trim(),
                email: normalizedCustomerEmail,
                phone: customerInfo.phone.trim()
            },
            shippingInfo: {
                address: shippingInfo.address.trim(),
                city: shippingInfo.city.trim(),
                postalCode: shippingInfo?.postalCode || "",
                country: shippingInfo?.country || "Pakistan",
                notes: shippingInfo?.notes || ""
            },
            billingInfo: {
                address: billingInfo.address.trim(),
                city: billingInfo.city.trim(),
                postalCode: billingInfo.postalCode || "",
                country: billingInfo.country || "Pakistan",
                phone: billingInfo.phone || customerInfo.phone
            },
            shippingMethod: selectedShipping,
            items: orderItemsSnapshot,
            pricing: {
                subtotal: calculatedSubtotal,
                discount: discountAmount,
                shippingCost,
                total
            },
            coupon: appliedCoupon,
            paymentMethod: paymentMethod || "COD",
            termsAccepted: true,
            termsAcceptedAt: new Date()
        });
    } catch (error) {
        for (const item of deductedItems) {
            if (item.size === "CUSTOM") {
                await Product.updateOne({ _id: item.productId }, { $inc: { soldCount: -item.quantity } });
            } else {
                await Product.updateOne(
                    { _id: item.productId },
                    {
                        $inc: {
                            "variants.$[v].sizes.$[s].stock": item.quantity,
                            soldCount: -item.quantity
                        }
                    },
                    { arrayFilters: [{ "v.colorName": item.color }, { "s.sku": item.sku }] }
                );
            }
        }
        if (error?.code === 11000 && idempotencyKey) {
            const existingOrder = await Order.findOne({ idempotencyKey });
            if (existingOrder) return res.status(200).json(new ApiResponse(200, existingOrder, "Order already placed"));
        }
        if (error?.code === 11000 && error?.keyPattern?.["customerInfo.email"] && error?.keyPattern?.["coupon.code"]) {
            throw new ApiError(400, "You have already used this coupon code.");
        }
        throw error;
    }

    //PHASE 12: Fire off emails asynchronously and in parallel
    try {
        await Promise.allSettled([
            sendOrderConfirmationEmail(order),
            sendAdminNewOrderNotification(order)
        ]);
    } catch (error) {
        console.error("Email dispatch failed during order creation:", error);
    }

    return res.status(201).json(new ApiResponse(201, order, "Order placed successfully"));
});

export const getMyOrders = asyncHandler(async (req, res) => {
    // req.user is guaranteed by verifyJWT
    const { page, limit, skip } = getPagination(req.query, { defaultLimit: 10 });
    const filter = { userRef: req.user._id };
    const [orders, total] = await Promise.all([
        Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        Order.countDocuments(filter)
    ]);

    return res.status(200).json(new ApiResponse(200, {
        orders,
        total,
        page,
        pages: Math.ceil(total / limit)
    }, "Orders fetched successfully"));
});

export const getOrderById = asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw new ApiError(404, "Order not found");

    // Security: Customers can only view their own orders; Admins can view any.
    if (req.user.role !== "admin" && order.userRef?.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "Unauthorized access to this order");
    }

    return res.status(200).json(new ApiResponse(200, order, "Order fetched successfully"));
});

export const getAllOrders = asyncHandler(async (req, res) => {
    const { sort = "newest", status, search, dateRange, dateFrom, dateTo } = req.query;
    const { page, limit, skip } = getPagination(req.query, { defaultLimit: 10 });

    // Base query
    const baseQuery = req.user.role === "admin" ? {} : { customer: req.user._id };

    // Search by Order ID, Name, or Phone
    if (search) {
        baseQuery.$or = [
            { orderNumber: { $regex: search, $options: "i" } },
            { "customerInfo.name": { $regex: search, $options: "i" } },
            { "customerInfo.phone": { $regex: search, $options: "i" } }
        ];
    }

    const now = new Date();
    let rangeStart;
    let rangeEnd;

    if (dateRange === "today") {
        rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        rangeEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    } else if (dateRange === "this_week") {
        const day = now.getDay();
        rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
        rangeEnd = new Date(rangeStart);
        rangeEnd.setDate(rangeStart.getDate() + 7);
    } else if (dateRange === "this_month") {
        rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
        rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    } else if (dateRange === "this_year") {
        rangeStart = new Date(now.getFullYear(), 0, 1);
        rangeEnd = new Date(now.getFullYear() + 1, 0, 1);
    } else if (dateRange === "custom") {
        rangeStart = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
        rangeEnd = dateTo ? new Date(`${dateTo}T00:00:00`) : null;
        if (rangeEnd) rangeEnd.setDate(rangeEnd.getDate() + 1);

        if ((rangeStart && Number.isNaN(rangeStart.getTime())) || (rangeEnd && Number.isNaN(rangeEnd.getTime()))) {
            throw new ApiError(400, "Invalid custom date range provided");
        }
        if (rangeStart && rangeEnd && rangeStart >= rangeEnd) {
            throw new ApiError(400, "Custom start date must be before the end date");
        }
    }

    if (rangeStart || rangeEnd) {
        baseQuery.createdAt = {};
        if (rangeStart) baseQuery.createdAt.$gte = rangeStart;
        if (rangeEnd) baseQuery.createdAt.$lt = rangeEnd;
    }

    // NEW: Calculate counts for each status using Aggregation
    const statusCountsAgg = await Order.aggregate([
        { $match: baseQuery },
        { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);

    const statusCounts = { Total: 0, Pending: 0, Confirmed: 0, Processing: 0, Shipped: 0, Delivered: 0, Cancelled: 0 };
    statusCountsAgg.forEach(item => {
        if (item._id && statusCounts[item._id] !== undefined) {
            statusCounts[item._id] = item.count;
        }
        statusCounts.Total += item.count;
    });

    // Apply the user's status filter for the actual list
    const query = { ...baseQuery };
    if (status) query.status = status;

    let sortOptions = { createdAt: -1 };
    if (sort === "oldest") sortOptions = { createdAt: 1 };
    if (sort === "amount_high") sortOptions = { "pricing.total": -1 };
    if (sort === "amount_low") sortOptions = { "pricing.total": 1 };

    const orders = await Order.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit);

    const total = await Order.countDocuments(query);

    return res.status(200).json(new ApiResponse(200, {
        orders,
        total,
        statusCounts, // <-- Sending the calculated counts to the frontend
        page,
        pages: Math.ceil(total / limit)
    }, "Orders fetched successfully"));
});

export const updateOrderStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    const validStatuses = ["Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"];

    if (!validStatuses.includes(status)) {
        throw new ApiError(400, "Invalid status provided");
    }

    const session = await mongoose.startSession();
    let order;

    try {
        await session.withTransaction(async () => {
            order = await Order.findById(req.params.id).session(session);

            if (!order) throw new ApiError(404, "Order not found");

            if (["Delivered", "Cancelled"].includes(order.status) && order.status !== status) {
                throw new ApiError(400, `Cannot change a ${order.status.toLowerCase()} order status`);
            }

            if (status === "Cancelled" && !order.inventoryRestoredAt) {
                for (const item of order.items) {
                    let result;
                    if (item.size === "CUSTOM") {
                        result = await Product.updateOne(
                            { _id: item.productId },
                            { $inc: { soldCount: -item.quantity } },
                            { session }
                        );
                    } else {
                        result = await Product.updateOne(
                            { _id: item.productId },
                            {
                                $inc: {
                                    "variants.$[v].sizes.$[s].stock": item.quantity,
                                    soldCount: -item.quantity
                                }
                            },
                            {
                                session,
                                arrayFilters: [{ "v.colorName": item.color }, { "s.sku": item.sku }]
                            }
                        );
                    }

                    if (result.modifiedCount !== 1) {
                        throw new ApiError(409, `Inventory could not be restored for ${item.name} (${item.size})`);
                    }
                }
                order.inventoryRestoredAt = new Date();
            }

            order.status = status;
            order.fulfillment = order.fulfillment || {};
            if (status === "Shipped" && !order.fulfillment?.shippedAt) {
                order.fulfillment.shippedAt = new Date();
            }
            if (status === "Delivered" && !order.fulfillment?.deliveredAt) {
                order.fulfillment.deliveredAt = new Date();
            }
            await order.save({ session });
        });
    } finally {
        await session.endSession();
    }


    //PHASE 12: Trigger status email
    try {
        await sendOrderStatusEmail(order);
    } catch (error) {
        console.error("Status email dispatch failed:", error);
    }
    return res.status(200).json(new ApiResponse(200, order, "Order status updated successfully"));
});

export const updateOrderFulfillment = asyncHandler(async (req, res) => {
    const { courier = "", trackingNumber = "", internalNotes = "", shippedAt = null, deliveredAt = null } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) throw new ApiError(404, "Order not found");

    const parseDate = (value, label) => {
        if (!value) return null;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) throw new ApiError(400, `Invalid ${label}`);
        return date;
    };

    order.fulfillment = {
        courier: String(courier).trim().slice(0, 120),
        trackingNumber: String(trackingNumber).trim().slice(0, 120),
        internalNotes: String(internalNotes).trim().slice(0, 1000),
        shippedAt: parseDate(shippedAt, "shipped date"),
        deliveredAt: parseDate(deliveredAt, "delivered date")
    };
    await order.save();
    return res.status(200).json(new ApiResponse(200, order, "Fulfillment details updated successfully"));
});

export const deleteOrder = asyncHandler(async (req, res) => {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) throw new ApiError(404, "Order not found");

    return res.status(200).json(new ApiResponse(200, {}, "Order deleted successfully"));
});
