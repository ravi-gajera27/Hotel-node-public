const mongoose = require("mongoose");

const LoginActivitySchema = new mongoose.Schema({
  activities: [
    {
      name: String,
      time: Number,
      device: String,
      role: String,
    },
  ],
  rest_id: String,
});

module.exports.LoginActivityModel = mongoose.model(
  "login-activities",
  LoginActivitySchema
);
