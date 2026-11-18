import { Router } from "express";
import { 
    createOrder, 
    getMyOrders, 
    getOrderById, 
    getAllOrders, 
    updateOrderStatus, 
    deleteOrder 
} from "./order.controller.js";
import { getShippingOptions, updateOrderFulfillment } from "./order.controller.js";
import { optionalAuth, verifyJWT, authorizeAdmin } from "../../middleware/auth.middleware.js";

const router = Router();

// Guest / Mixed route
router.route("/").post(optionalAuth, createOrder);
router.get("/shipping-options", getShippingOptions);

// Protected Customer Routes
router.use(verifyJWT);
router.route("/my-orders").get(getMyOrders);
router.route("/:id").get(getOrderById);

// Admin-Only Routes
router.use(authorizeAdmin);
router.route("/").get(getAllOrders);
router.route("/:id/status").patch(updateOrderStatus);
router.route("/:id/fulfillment").patch(updateOrderFulfillment);
router.route("/:id").delete(deleteOrder);

export default router;
