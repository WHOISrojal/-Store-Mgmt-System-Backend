const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    category: {
      type: String,
      default: "General",
    },

    barcode: {
      type: String,
      default: "",
    },

    lotNo: {
      type: String,
      default: "",
    },

    code: {
      type: String,
      default: "",
    },

    image: {
      type: String,
      default: "",
    },

    costPrice: {
      type: Number,
      required: true,
    },

    sellingPrice: {
      type: Number,
      required: true,
    },

    stock: {
      type: Number,
      default: 0,
    },

    minimumStock: {
      type: Number,
      default: 5,
    },

    unit: {
      type: String,
      default: "pcs",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Product", productSchema);