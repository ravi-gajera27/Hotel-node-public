const mongoose = require("mongoose");

const restDetailsSchema = new mongoose.Schema({
  rest_id: String,
  visit: String,
  last_visit: String,
  m_visit: String,
  review: { rating: String, text: String },
})


const customnerSchema = new mongoose.Schema({
  cname: String,
  mobile_no: String,
  bod: String,
  blocked: Boolean,
  join: String,
  join_date: String,
  rest_details:[restDetailsSchema]
});


module.exports.CustomerModel = mongoose.model("customers", customnerSchema);
