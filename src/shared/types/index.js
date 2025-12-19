// Core data models and interfaces for Picksy refactor
// Based on design document specifications
export var SubscriptionTier;
(function (SubscriptionTier) {
    SubscriptionTier["FREE"] = "free";
    SubscriptionTier["PREMIUM"] = "premium";
    SubscriptionTier["ENTERPRISE"] = "enterprise";
})(SubscriptionTier || (SubscriptionTier = {}));
export var NotificationChannel;
(function (NotificationChannel) {
    NotificationChannel["BROWSER"] = "browser";
    NotificationChannel["EMAIL"] = "email";
    NotificationChannel["PUSH"] = "push";
})(NotificationChannel || (NotificationChannel = {}));
export var AvailabilityStatus;
(function (AvailabilityStatus) {
    AvailabilityStatus["IN_STOCK"] = "in_stock";
    AvailabilityStatus["OUT_OF_STOCK"] = "out_of_stock";
    AvailabilityStatus["LIMITED_STOCK"] = "limited_stock";
    AvailabilityStatus["UNKNOWN"] = "unknown";
})(AvailabilityStatus || (AvailabilityStatus = {}));
export var DataSource;
(function (DataSource) {
    DataSource["OFFICIAL_API"] = "official_api";
    DataSource["LEGAL_SCRAPER"] = "legal_scraper";
    DataSource["CACHED"] = "cached";
})(DataSource || (DataSource = {}));
export var PriceTrend;
(function (PriceTrend) {
    PriceTrend["INCREASING"] = "increasing";
    PriceTrend["DECREASING"] = "decreasing";
    PriceTrend["STABLE"] = "stable";
    PriceTrend["VOLATILE"] = "volatile";
})(PriceTrend || (PriceTrend = {}));
export var AlertType;
(function (AlertType) {
    AlertType["PRICE_DROP"] = "price_drop";
    AlertType["PRICE_INCREASE"] = "price_increase";
    AlertType["BACK_IN_STOCK"] = "back_in_stock";
    AlertType["TARGET_PRICE_REACHED"] = "target_price_reached";
})(AlertType || (AlertType = {}));
export var ErrorCode;
(function (ErrorCode) {
    ErrorCode["UNSUPPORTED_SITE"] = "UNSUPPORTED_SITE";
    ErrorCode["RATE_LIMITED"] = "RATE_LIMITED";
    ErrorCode["PRODUCT_NOT_FOUND"] = "PRODUCT_NOT_FOUND";
    ErrorCode["AUTHENTICATION_FAILED"] = "AUTHENTICATION_FAILED";
    ErrorCode["EXTERNAL_SERVICE_ERROR"] = "EXTERNAL_SERVICE_ERROR";
    ErrorCode["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    ErrorCode["PERMISSION_DENIED"] = "PERMISSION_DENIED";
})(ErrorCode || (ErrorCode = {}));
