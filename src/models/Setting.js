const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema(
  {
    storeName: {
      type: String,
      default: "Store Management System",
    },

    address: {
      type: String,
      default: "",
    },

    phone: {
      type: String,
      default: "",
    },

    vatNumber: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "Setting",
  settingSchema
);