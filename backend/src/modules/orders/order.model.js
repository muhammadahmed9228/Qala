import mongoose, { Schema } from "mongoose";

const orderItemSchema = new Schema({
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    color: { type: String, required: true },
    size: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true }, // The authoritative price at purchase time
    image: { type: String, required: true },
    // NEW: Store user's custom measurements if they selected "CUSTOM" size
    customMeasurements: { 
        type: Map, 
        of: String 
    }
});

const orderSchema = new Schema(
    {
        orderNumber: { type: String, required: true, unique: true },
        userRef: { type: Schema.Types.ObjectId, ref: "User", default: null }, // Null for guests
        status: {
            type: String,
            enum: ["Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled"],
            default: "Pending"
        },
        customerInfo: {
            name: { type: String, required: true },
            email: { type: String, required: true },
            phone: { type: String, required: true }
        },
        shippingInfo: {
            address: { type: String, required: true },
            city: { type: String, required: true },
            postalCode: { type: String, default: "" },
            country: { type: String, default: "Pakistan" },
            notes: { type: String }
        },
        billingInfo: {
            address: { type: String, default: "" },
            city: { type: String, default: "" },
            postalCode: { type: String, default: "" },
            country: { type: String, default: "Pakistan" },
            phone: { type: String, default: "" }
        },
        shippingMethod: {
            code: { type: String, default: "flat_rate" },
            name: { type: String, default: "Standard Delivery" },
            minDays: { type: Number, default: 2 },
            maxDays: { type: Number, default: 5 }
        },
        items: [orderItemSchema],
        pricing: {
            subtotal: { type: Number, required: true },
            discount: { type: Number, default: 0 },
            shippingCost: { type: Number, required: true },
            total: { type: Number, required: true }
        },
        coupon: {
            code: { type: String },
            discountType: { type: String },
            discountValue: { type: Number },
            discountAmount: { type: Number }
        },
        paymentMethod: { type: String, enum: ["COD", "BANK_TRANSFER"], default: "COD" },
        fulfillment: {
            courier: { type: String, default: "" },
            trackingNumber: { type: String, default: "" },
            internalNotes: { type: String, default: "" },
            shippedAt: { type: Date, default: null },
            deliveredAt: { type: Date, default: null }
        },
        inventoryRestoredAt: { type: Date, default: null },
        idempotencyKey: { type: String, unique: true, sparse: true, index: true },
        termsAccepted: { type: Boolean, default: false },
        termsAcceptedAt: { type: Date, default: null }
    },
    { timestamps: true }
);

// A customer may use a coupon code only once while an order is active. The
// partial index excludes cancelled orders so the code can be used again after
// cancellation, while the unique constraint closes concurrent checkout races.
orderSchema.index(
    { "customerInfo.email": 1, "coupon.code": 1 },
    {
        unique: true,
        partialFilterExpression: {
            "coupon.code": { $type: "string" },
            status: { $in: ["Pending", "Confirmed", "Processing", "Shipped", "Delivered"] }
        }
    }
);

export const Order = mongoose.model("Order", orderSchema);
