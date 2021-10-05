const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema({
  rest_id: String,
  cname: String,
  date: String,
  review: { retting: Number, text: String },
});

module.exports.ReviewModel = mongoose.model("reviews", reviewSchema);
