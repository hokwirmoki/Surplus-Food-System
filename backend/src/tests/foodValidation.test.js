const request = require("supertest");
const app = require("../app.js");

// login token for donor
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sZSI6ImRvbm9yIiwiaWF0IjoxNzc3Mjg0NTY4LCJleHAiOjE3NzczNzA5Njh9.4jgjyPK_6xntQAkItNqBSlZoNNZ1HvncqO7c7iD3ASk";

describe("Food Validation Tests - Surplus Food System", () => {

    // Missing location
    it("should return 400 when location is missing", async () => {
        const res = await request(app)
            .post("/api/food/post")
            .set("Authorization", `Bearer ${token}`)
            .send({
                food_type: "Rice",
                quantity: "2 plates",
                expiry_time: "2026-04-28T15:00:00.000Z"
            });

        expect(res.statusCode).toBe(400);
    });

    // Missing food type
    it("should return 400 when food_type is missing", async () => {
        const res = await request(app)
            .post("/api/food/post")
            .set("Authorization", `Bearer ${token}`)
            .send({
                quantity: "2 plates",
                location: "Kampala",
                latitude: 0.3476,
                longitude: 32.5825,
                expiry_time: "2026-04-28T15:00:00.000Z"
            });

        expect(res.statusCode).toBe(400);
    });

    // Successful food creation
    it("should create food successfully", async () => {
        const res = await request(app)
            .post("/api/food/post")
            .set("Authorization", `Bearer ${token}`)
            .send({
                food_type: "Beans",
                quantity: "3 plates",
                location: "Kampala",
                latitude: 0.3476,
                longitude: 32.5825,
                expiry_time: "2026-04-28T15:00:00.000Z"
            });

        expect(res.statusCode).toBe(201);
        expect(res.body.food_type).toBe("Beans");
        expect(res.body.status).toBe("available");
    });

});