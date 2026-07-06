const mongoose = require("mongoose");

const customerTransactionSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },

    type: {
      type: String,
      enum: ["PURCHASE", "PAYMENT"],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    // Only relevant when type === "PAYMENT". Tracks how the money came in.
    paymentMethod: {
      type: String,
      enum: ["CASH", "ONLINE"],
      default: "CASH",
    },

    note: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "CustomerTransaction",
  customerTransactionSchema
);