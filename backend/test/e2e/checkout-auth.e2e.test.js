import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import axios from "axios";

process.env.NODE_ENV = "development";
process.env.EMAIL_TEST_MODE = "true";
process.env.CORS_ORIGIN = "http://localhost";

const { app } = await import("../../src/app.js");
const { User } = await import("../../src/modules/auth/user.model.js");
const { Product } = await import("../../src/modules/products/product.model.js");
const { Order } = await import("../../src/modules/orders/order.model.js");
const { Coupon } = await import("../../src/modules/coupons/coupon.model.js");
const { hashRefreshToken } = await import("../../src/modules/auth/auth.security.js");

let mongo;
const originalAxiosPost = axios.post;

test.before(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri(), { dbName: "qala-e2e" });
    await Promise.all([User.init(), Product.init(), Order.init(), Coupon.init()]);

    axios.post = async (url) => {
        if (url.includes("turnstile")) return { data: { success: true } };
        return originalAxiosPost(url);
    };
});

test.after(async () => {
    axios.post = originalAxiosPost;
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongo) await mongo.stop();
    delete process.env.EMAIL_TEST_MODE;
});

test.beforeEach(async () => {
    await Promise.all([
        User.deleteMany({}),
        Product.deleteMany({}),
        Order.deleteMany({}),
        Coupon.deleteMany({})
    ]);
});

const getCsrf = async () => {
    const response = await request(app).get("/api/v1/auth/csrf-token");
    const csrfCookie = response.headers["set-cookie"]
        .find((cookie) => cookie.startsWith("csrfToken="))
        .split(";", 1)[0];

    return {
        token: response.body.data.csrfToken,
        cookie: csrfCookie
    };
};

const createProduct = async (stock = 2) => Product.create({
    name: `E2E Product ${crypto.randomUUID()}`,
    slug: `e2e-${crypto.randomUUID()}`,
    description: "E2E test product",
    basePrice: 1000,
    published: true,
    thumbnail: { url: "https://example.com/product.jpg", fileId: "e2e-thumbnail" },
    variants: [{
        colorName: "Black",
        colorCode: "#000000",
        images: [],
        sizes: [{ size: "S", sku: `E2E-${crypto.randomUUID()}`, stock }]
    }]
});

const createOrderPayload = (product, overrides = {}) => ({
    customerInfo: {
        name: "E2E Customer",
        email: "customer@example.com",
        phone: "03322363113"
    },
    shippingInfo: {
        address: "1 Test Street",
        city: "Lahore",
        postalCode: "54000",
        country: "Pakistan"
    },
    billingInfo: {
        address: "1 Test Street",
        city: "Lahore",
        postalCode: "54000",
        country: "Pakistan",
        phone: "03322363113"
    },
    items: [{
        productId: product._id.toString(),
        name: product.name,
        sku: product.variants[0].sizes[0].sku,
        color: "Black",
        size: "S",
        quantity: 1,
        image: product.thumbnail.url
    }],
    turnstileToken: "e2e-turnstile-token",
    termsAccepted: true,
    paymentMethod: "COD",
    shippingMethod: "flat_rate",
    ...overrides
});

const placeOrder = async (payload) => {
    const csrf = await getCsrf();
    return request(app)
        .post("/api/v1/orders")
        .set("Cookie", csrf.cookie)
        .set("X-CSRF-Token", csrf.token)
        .send(payload);
};

const createAdminToken = async () => {
    const admin = await User.create({
        name: "E2E Admin",
        email: "admin@example.com",
        password: "Password123",
        role: "admin",
        isEmailVerified: true
    });
    return admin.generateAccessToken();
};

test("checkout idempotency prevents duplicate clicks from creating duplicate orders", async () => {
    const product = await createProduct(1);
    const payload = createOrderPayload(product, { idempotencyKey: "e2e-idempotency-key" });

    const first = await placeOrder(payload);
    const second = await placeOrder(payload);

    assert.equal(first.status, 201);
    assert.equal(second.status, 200);
    assert.equal(await Order.countDocuments({}), 1);

    const updatedProduct = await Product.findById(product._id);
    assert.equal(updatedProduct.variants[0].sizes[0].stock, 0);
});

test("concurrent one-time coupon checkout permits only one order", async () => {
    const product = await createProduct(2);
    await Coupon.create({
        code: "ONCE1",
        discountType: "fixed",
        discountValue: 100,
        expiryDate: new Date(Date.now() + 86400000),
        isActive: true
    });

    const payload = createOrderPayload(product, { couponCode: "ONCE1" });
    const responses = await Promise.all([placeOrder(payload), placeOrder(payload)]);
    const statuses = responses.map((response) => response.status).sort();

    assert.deepEqual(statuses, [201, 400]);
    assert.equal(await Order.countDocuments({ "coupon.code": "ONCE1" }), 1);

    const updatedProduct = await Product.findById(product._id);
    assert.equal(updatedProduct.variants[0].sizes[0].stock, 1);
});

test("concurrent cancellation restores inventory only once", async () => {
    const product = await createProduct(1);
    const orderResponse = await placeOrder(createOrderPayload(product));
    assert.equal(orderResponse.status, 201);

    const adminToken = await createAdminToken();
    const csrfRequests = await Promise.all([getCsrf(), getCsrf()]);
    const responses = await Promise.all(csrfRequests.map((csrf) => request(app)
        .patch(`/api/v1/orders/${orderResponse.body.data._id}/status`)
        .set("Cookie", [csrf.cookie, `accessToken=${adminToken}`])
        .set("X-CSRF-Token", csrf.token)
        .send({ status: "Cancelled" })));

    assert.ok(responses.some((response) => response.status === 200));

    const finalOrder = await Order.findById(orderResponse.body.data._id);
    const updatedProduct = await Product.findById(product._id);
    assert.equal(finalOrder.status, "Cancelled");
    assert.ok(finalOrder.inventoryRestoredAt);
    assert.equal(updatedProduct.variants[0].sizes[0].stock, 1);
    assert.equal(updatedProduct.soldCount, 0);
});

test("checkout rejects an out-of-stock item without creating an order", async () => {
    const product = await createProduct(0);
    const response = await placeOrder(createOrderPayload(product));

    assert.equal(response.status, 400);
    assert.equal(await Order.countDocuments({}), 0);
});

test("refresh rotates HTTP-only cookies without returning tokens in JSON", async () => {
    const user = await User.create({
        name: "Refresh User",
        email: "refresh@example.com",
        password: "Password123",
        isEmailVerified: true
    });
    const refreshToken = user.generateRefreshToken();
    user.refreshTokenHash = hashRefreshToken(refreshToken);
    await user.save({ validateBeforeSave: false });

    const csrf = await getCsrf();
    const response = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", [csrf.cookie, `refreshToken=${refreshToken}`])
        .set("X-CSRF-Token", csrf.token)
        .send({});

    assert.equal(response.status, 200);
    assert.ok(response.body.data.user);
    assert.equal(response.body.data.accessToken, undefined);
    assert.equal(response.body.data.refreshToken, undefined);
    assert.ok(response.headers["set-cookie"].some((cookie) => cookie.startsWith("accessToken=")));
    assert.ok(response.headers["set-cookie"].some((cookie) => cookie.startsWith("refreshToken=")));
});
