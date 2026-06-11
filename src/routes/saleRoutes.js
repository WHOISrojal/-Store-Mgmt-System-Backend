const express = require("express");
const router = express.Router();

const Sale = require("../models/Sale");
const Product = require("../models/Product");
const AuditLog = require("../models/AuditLog");
const Customer = require("../models/Customer");
const CustomerTransaction = require("../models/CustomerTransaction");
const StockMovement = require("../models/StockMovement");

// Get All Sales
router.get("/", async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = 20;

    const sales = await Sale.find()
      .populate("items.product")
      .populate("customer")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const totalSales = await Sale.countDocuments();

    res.json({
      sales,
      totalPages: Math.ceil(totalSales / limit),
      currentPage: page,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// Create Sale (Cart Based)
router.post("/", async (req, res) => {
  try {
    const { customer, items, paymentType } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({
        message: "Cart is empty",
      });
    }

    let saleItems = [];
    let totalAmount = 0;
    let profit = 0;

    for (const item of items) {
      const product = await Product.findById(item.product);

      if (!product) {
        return res.status(404).json({
          message: "Product not found",
        });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          message: `${product.name} has insufficient stock`,
        });
      }

      const itemTotal = product.sellingPrice * item.quantity;

      const itemProfit =
        (product.sellingPrice - product.costPrice) * item.quantity;

      saleItems.push({
        product: product._id,
        quantity: item.quantity,
        sellingPrice: product.sellingPrice,
        costPrice: product.costPrice,
        total: itemTotal,
      });

      totalAmount += itemTotal;
      profit += itemProfit;

      product.stock -= item.quantity;

      await StockMovement.create({
        product: product._id,
        type: "SALE",
        quantity: item.quantity,
        note: `Sale`,
      });

      await product.save();
    }

    let customerRecord = null;

    if (customer) {
      customerRecord = await Customer.findById(customer);

      if (!customerRecord) {
        return res.status(404).json({
          message: "Customer not found",
        });
      }
    }

    const sale = new Sale({
      customer: customerRecord?._id || null,
      paymentType: paymentType || "CASH",
      items: saleItems,
      totalAmount,
      profit,
    });

    const savedSale = await sale.save();
    if (paymentType === "CREDIT" && customerRecord) {
      customerRecord.dueAmount += totalAmount;

      await customerRecord.save();

      await CustomerTransaction.create({
        customer: customerRecord._id,
        type: "PURCHASE",
        amount: totalAmount,
        note: `Credit Sale #${savedSale._id}`,
      });
    }
    await AuditLog.create({
      user: req.headers["x-user"] || "Unknown",
      action: "CREATE SALE",
      details: `${
        customerRecord?.name || "Walk-in Customer"
      } | ${paymentType || "CASH"} | Rs.${totalAmount}`,
    });

    res.status(201).json(savedSale);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

router.get("/customer/:customerId", async (req, res) => {
  try {
    const sales = await Sale.find({
      customer: req.params.customerId,
    })
      .populate("items.product")
      .sort({ createdAt: -1 });

    res.json(sales);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// Get One Sale
router.get("/:id", async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate("items.product")
      .populate("customer");

    if (!sale) {
      return res.status(404).json({
        message: "Sale not found",
      });
    }

    res.json(sale);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { items } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({
        message: "Sale must contain at least one product",
      });
    }

    const sale = await Sale.findById(req.params.id);

    if (!sale) {
      return res.status(404).json({
        message: "Sale not found",
      });
    }

    const oldTotalAmount = sale.totalAmount;

    // Restore old stock
    for (const oldItem of sale.items) {
      const product = await Product.findById(oldItem.product);

      if (product) {
        product.stock += oldItem.quantity;
        await product.save();
      }
    }

    let totalAmount = 0;
    let profit = 0;
    const newItems = [];

    for (const item of items) {
      const product = await Product.findById(item.product);

      if (!product) {
        return res.status(404).json({
          message: "Product not found",
        });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          message: `${product.name} has insufficient stock`,
        });
      }

      const itemTotal = product.sellingPrice * item.quantity;

      const itemProfit =
        (product.sellingPrice - product.costPrice) * item.quantity;

      newItems.push({
        product: product._id,
        quantity: item.quantity,
        sellingPrice: product.sellingPrice,
        costPrice: product.costPrice,
        total: itemTotal,
      });

      totalAmount += itemTotal;
      profit += itemProfit;

      product.stock -= item.quantity;

      await product.save();
    }

    sale.items = newItems;
    sale.totalAmount = totalAmount;
    sale.profit = profit;

    await sale.save();

    if (sale.paymentType === "CREDIT" && sale.customer) {
      const customer = await Customer.findById(sale.customer);

      if (customer) {
        customer.dueAmount = customer.dueAmount - oldTotalAmount + totalAmount;

        await customer.save();
      }

      await CustomerTransaction.findOneAndUpdate(
        {
          customer: sale.customer,
          type: "PURCHASE",
          note: `Credit Sale #${sale._id}`,
        },
        {
          amount: totalAmount,
        },
      );
    }

    await AuditLog.create({
      user: req.headers["x-user"] || "Unknown",
      action: "EDIT SALE",
      details: `Sale ${sale._id}`,
    });

    res.json({
      message: "Sale updated successfully",
      sale,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

// Delete Sale
router.delete("/:id", async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate("items.product")
      .populate("customer");

    if (!sale) {
      return res.status(404).json({
        message: "Sale not found",
      });
    }

    for (const item of sale.items) {
      const product = await Product.findById(item.product);

      if (product) {
        product.stock += item.quantity;

        await StockMovement.create({
          product: product._id,
          type: "RETURN",
          quantity: item.quantity,
          note: "Sale Deleted",
        });
        await product.save();
      }
    }

    if (sale.paymentType === "CREDIT" && sale.customer) {
      const customer = await Customer.findById(sale.customer._id);

      if (customer) {
        customer.dueAmount -= sale.totalAmount;

        if (customer.dueAmount < 0) {
          customer.dueAmount = 0;
        }

        await customer.save();
      }

      await CustomerTransaction.deleteOne({
        customer: sale.customer._id,
        type: "PURCHASE",
        note: `Credit Sale #${sale._id}`,
      });
    }

    await Sale.findByIdAndDelete(req.params.id);
    const productSummary = sale.items
      .map((item) => `${item.product.name} (${item.quantity})`)
      .join(", ");

    await AuditLog.create({
      user: req.headers["x-user"] || "Unknown",
      action: "DELETE SALE",
      details: `${sale.customer} | ${productSummary} | Rs.${sale.totalAmount}`,
    });

    res.json({
      message: "Sale deleted and stock restored",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

module.exports = router;
