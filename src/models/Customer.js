const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    phone: {
      type: String,
      required: true,
    },

    panNumber: {
      type: String,
      required: true,
      match: [/^\d{9}$/, "PAN must be exactly 9 digits"],
    },

    address: {
      type: String,
      default: "",
    },

    companyName: {
      type: String,
      default: "",
    },

    dueAmount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Customer", customerSchema);