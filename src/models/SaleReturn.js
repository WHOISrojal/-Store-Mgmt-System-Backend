const mongoose = require("mongoose");

const saleReturnSchema =
  new mongoose.Schema(
    {
      sale: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Sale",
        required: true,
      },

      product: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
      },

      quantity: {
        type: Number,
        required: true,
      },

      amount: {
        type: Number,
        required: true,
      },

      profitReduction: {
        type: Number,
        required: true,
      },

      reason: {
        type: String,
        default: "",
      },
    },
    {
      timestamps: true,
    }
  );

module.exports = mongoose.model(
  "SaleReturn",
  saleReturnSchema
);