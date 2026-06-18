const mongoose = require("mongoose");

const saleSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },

    paymentType: {
      type: String,
      enum: ["CASH", "CREDIT", "CHEQUE"],
      default: "CASH",
    },

    chequeNumber: {
      type: String,
      default: "",
    },

    bankName: {
      type: String,
      default: "",
    },

    chequeDate: {
      type: Date,
      default: null,
    },

    chequeStatus: {
      type: String,
      enum: ["PENDING", "CLEARED", "BOUNCED"],
      default: "PENDING",
    },

    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },

        quantity: {
          type: Number,
          required: true,
        },

        sellingPrice: {
          type: Number,
          required: true,
        },

        costPrice: {
          type: Number,
          required: true,
        },

        total: {
          type: Number,
          required: true,
        },
      },
    ],

    totalAmount: {
      type: Number,
      required: true,
    },

    profit: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Sale", saleSchema);
