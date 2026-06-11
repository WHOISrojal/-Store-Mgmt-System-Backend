const mongoose = require("mongoose");

const supplierTransactionSchema =
  new mongoose.Schema(
    {
      supplier: {
        type:
          mongoose.Schema.Types.ObjectId,
        ref: "Supplier",
        required: true,
      },

      type: {
        type: String,
        enum: [
          "PURCHASE",
          "PAYMENT",
        ],
        required: true,
      },

      amount: {
        type: Number,
        required: true,
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
  "SupplierTransaction",
  supplierTransactionSchema
);