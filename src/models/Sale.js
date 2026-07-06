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

    // ── Discount ──────────────────────────────────────
    // discountType: FLAT = a fixed rupee amount, PERCENT = % of subtotal
    discountType: {
      type: String,
      enum: ["FLAT", "PERCENT"],
      default: "FLAT",
    },

    discountValue: {
      // the raw number the user entered (e.g. 10 for 10% or Rs.10 flat)
      type: Number,
      default: 0,
    },

    discountAmount: {
      // resolved rupee value of the discount (always in Rs, computed from discountValue/type)
      type: Number,
      default: 0,
    },

    subtotal: {
      // sum of item totals BEFORE discount
      type: Number,
      required: true,
    },

    totalAmount: {
      // subtotal - discountAmount (this is what's actually charged)
      type: Number,
      required: true,
    },

    // ── Advance payment (CREDIT / CHEQUE sales only) ────
    // Rs. amount paid up-front at time of sale. The remaining balance
    // (totalAmount - amountPaid) is what's still owed by the customer.
    // For CASH sales this stays 0 since the full amount is settled instantly.
    amountPaid: {
      type: Number,
      default: 0,
    },

    // ── Advance payment method (CASH or ONLINE) ─────────
    // Only meaningful when amountPaid > 0. Tracks how the advance was
    // received so the ledger/invoice can distinguish cash-in-hand vs
    // bank transfer / digital payment.
    advancePaymentMethod: {
      type: String,
      enum: ["CASH", "ONLINE", null],
      default: null,
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