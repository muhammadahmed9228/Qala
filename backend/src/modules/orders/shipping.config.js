const numberFromEnv = (name, fallback) => {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
};

const integerFromEnv = (name, fallback) => {
    const value = Number(process.env[name]);
    return Number.isInteger(value) && value >= 0 ? value : fallback;
};

export const getShippingOptions = () => ([
    (() => {
        const minDays = integerFromEnv("SHIPPING_MIN_DAYS", 2);
        return {
            code: "flat_rate",
            name: "Standard Delivery",
            cost: numberFromEnv("SHIPPING_FLAT_RATE", 250),
            minDays,
            maxDays: Math.max(minDays, integerFromEnv("SHIPPING_MAX_DAYS", 5))
        };
    })()
]);

export const getShippingOption = (code = "flat_rate") =>
    getShippingOptions().find((option) => option.code === code);
