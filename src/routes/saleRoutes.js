const express = require("express");
const router  = express.Router();

const Sale                = require("../models/Sale");
const Product              = require("../models/Product");
const AuditLog             = require("../models/AuditLog");
const Customer              = require("../models/Customer");
const CustomerTransaction   = require("../models/CustomerTransaction");
const StockMovement         = require("../models/StockMovement");

// ── helper: resolve discount into a Rs. amount, clamped to [0, subtotal] ──
function resolveDiscount(discountType, discountValue, subtotal) {
  const type  = discountType === "PERCENT" ? "PERCENT" : "FLAT";
  let   value = Number(discountValue) || 0;
  if (value < 0) value = 0;

  let amount = type === "PERCENT" ? (subtotal * value) / 100 : value;
  if (amount > subtotal) amount = subtotal; // never discount below zero
  amount = Math.round(amount * 100) / 100;  // 2dp

  return { type, value, amount };
}

// ── GET /sales  (paginated) ───────────────────────────────
router.get("/", async (req, res) => {
  try {
    const page  = Math.max(1, Number(req.query.page) || 1);
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
      totalPages:  Math.ceil(totalSales / limit),
      currentPage: page,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── GET /sales/cheques/stats ──────────────────────────────
// IMPORTANT: must be defined BEFORE /cheques and /:id
router.get("/cheques/stats", async (req, res) => {
  try {
    const now = new Date();

    const [pending, cleared, bounced, pendingDocs] = await Promise.all([
      Sale.countDocuments({ paymentType: "CHEQUE", chequeStatus: "PENDING" }),
      Sale.countDocuments({ paymentType: "CHEQUE", chequeStatus: "CLEARED" }),
      Sale.countDocuments({ paymentType: "CHEQUE", chequeStatus: "BOUNCED" }),
      Sale.find({ paymentType: "CHEQUE", chequeStatus: "PENDING" }).select("chequeDate totalAmount"),
    ]);

    const overdue           = pendingDocs.filter(c => new Date(c.chequeDate) < now).length;
    const totalPendingValue = pendingDocs.reduce((s, c) => s + (c.totalAmount || 0), 0);

    res.json({ pending, cleared, bounced, overdue, totalPendingValue });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── GET /sales/cheques  (paginated + filter + search) ─────
router.get("/cheques", async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.max(1, parseInt(req.query.limit) || 15);
    const skip   = (page - 1) * limit;
    const status = req.query.status?.trim();   // PENDING | CLEARED | BOUNCED | OVERDUE
    const search = req.query.search?.trim();
    const now    = new Date();

    const filter = { paymentType: "CHEQUE" };

    if (status && status !== "ALL") {
      if (status === "OVERDUE") {
        filter.chequeStatus = "PENDING";
        filter.chequeDate   = { $lt: now };
      } else {
        filter.chequeStatus = status;
      }
    }

    if (search) {
      // search by cheque number, bank name, or customer name/PAN (via populate)
      const matchingCustomers = await Customer.find({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { panNumber: { $regex: search, $options: "i" } },
        ],
      }).select("_id");

      filter.$or = [
        { chequeNumber: { $regex: search, $options: "i" } },
        { bankName:     { $regex: search, $options: "i" } },
        { customer: { $in: matchingCustomers.map(c => c._id) } },
      ];
    }

    const [cheques, totalCount] = await Promise.all([
      Sale.find(filter)
        .populate("customer")
        .sort({ chequeDate: 1 })
        .skip(skip)
        .limit(limit),
      Sale.countDocuments(filter),
    ]);

    res.json({
      cheques,
      currentPage: page,
      totalPages:  Math.ceil(totalCount / limit),
      totalCount,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── GET /sales/customer/:customerId ──────────────────────
router.get("/customer/:customerId", async (req, res) => {
  try {
    const sales = await Sale.find({ customer: req.params.customerId })
      .populate("items.product")
      .sort({ createdAt: -1 });
    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── GET /sales/:id ───────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate("items.product")
      .populate("customer");
    if (!sale) return res.status(404).json({ message: "Sale not found" });
    res.json(sale);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── POST /sales ──────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const {
      customer, items, paymentType, chequeNumber, bankName, chequeDate,
      discountType, discountValue, paidAmount, advancePaymentMethod,
    } = req.body;

    if (!items || items.length === 0)
      return res.status(400).json({ message: "Cart is empty" });

    let saleItems   = [];
    let subtotal    = 0;
    let profit      = 0;

    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) return res.status(404).json({ message: "Product not found" });
      if (product.stock < item.quantity)
        return res.status(400).json({ message: `${product.name} has insufficient stock` });

      const itemTotal  = product.sellingPrice * item.quantity;
      const itemProfit = (product.sellingPrice - product.costPrice) * item.quantity;

      saleItems.push({
        product: product._id, quantity: item.quantity,
        sellingPrice: product.sellingPrice, costPrice: product.costPrice, total: itemTotal,
      });

      subtotal += itemTotal;
      profit   += itemProfit;
      product.stock -= item.quantity;
      await product.save();
    }

    // ── Discount ──────────────────────────────────────
    const { type: discType, value: discValue, amount: discountAmount } =
      resolveDiscount(discountType, discountValue, subtotal);

    const totalAmount = Math.round((subtotal - discountAmount) * 100) / 100;
    profit             = Math.round((profit - discountAmount) * 100) / 100; // discount eats into profit

    let customerRecord = null;
    if (customer) {
      customerRecord = await Customer.findById(customer);
      if (!customerRecord) return res.status(404).json({ message: "Customer not found" });
    }

    // ── Advance payment (CREDIT / CHEQUE only) ─────────
    // Clamp to [0, totalAmount] so it can never overpay or go negative.
    // CASH sales are settled in full at the point of sale, so amountPaid stays 0
    // there — the "paid" amount is implicitly the whole totalAmount, not a partial.
    let amountPaid = Number(paidAmount) || 0;
    if (amountPaid < 0) amountPaid = 0;
    if (amountPaid > totalAmount) amountPaid = totalAmount;
    if (paymentType !== "CREDIT" && paymentType !== "CHEQUE") amountPaid = 0;

    // Advance payment method (CASH / ONLINE) only makes sense when an
    // advance is actually being paid. Defaults to CASH if not specified.
    let advMethod = null;
    if (amountPaid > 0) {
      advMethod = advancePaymentMethod === "ONLINE" ? "ONLINE" : "CASH";
    }

    const sale = new Sale({
      customer: customerRecord?._id || null,
      paymentType: paymentType || "CASH",
      chequeNumber, bankName, chequeDate,
      items: saleItems,
      subtotal,
      discountType: discType,
      discountValue: discValue,
      discountAmount,
      totalAmount,
      amountPaid,
      advancePaymentMethod: advMethod,
      profit,
    });
    const savedSale = await sale.save();

    for (const item of saleItems) {
      await StockMovement.create({
        product: item.product, type: "SALE", quantity: item.quantity,
        note: `${paymentType || "CASH"} Sale INV-${savedSale._id.toString().slice(-6).toUpperCase()}`,
      });
    }

    // ── Customer ledger ────────────────────────────────
    // CASH: money is settled instantly at point of sale, so it must NEVER
    // move dueAmount and must NEVER leave a net balance behind in the
    // customer's transaction history. We still record it (for purchase
    // history / receipts) but as a PURCHASE immediately offset by a
    // PAYMENT of the same amount, so the running "balance after" stays
    // flat. (A CASH sale must not affect dueAmount — only CREDIT/CHEQUE do.)
    if (paymentType === "CASH" && customerRecord) {
      const invNo = `INV-${savedSale._id.toString().slice(-6).toUpperCase()}`;
      await CustomerTransaction.create({
        customer: customerRecord._id,
        type: "PURCHASE",
        amount: totalAmount,
        note: `CASH Sale ${invNo}`,
      });
      await CustomerTransaction.create({
        customer: customerRecord._id,
        type: "PAYMENT",
        amount: totalAmount,
        note: `CASH Sale ${invNo} (paid in full)`,
      });
    }

    // CREDIT / CHEQUE: real receivables — money is genuinely owed until
    // a separate payment event happens later (advance payment, due
    // clearance, or cheque clearing).
    if ((paymentType === "CREDIT" || paymentType === "CHEQUE") && customerRecord) {
      customerRecord.dueAmount += totalAmount;
      await customerRecord.save();
      await CustomerTransaction.create({ customer: customerRecord._id, type: "PURCHASE", amount: totalAmount, note: `${paymentType} Sale INV-${savedSale._id.toString().slice(-6).toUpperCase()}` });
    }

    await AuditLog.create({
      user: req.headers["x-user"] || "Unknown",
      action: "CREATE SALE",
      details: `${customerRecord?.name || "Walk-in Customer"} | ${paymentType || "CASH"} | Rs.${totalAmount}${discountAmount ? ` | Discount: Rs.${discountAmount}` : ""}${amountPaid ? ` | Advance: Rs.${amountPaid} (${advMethod})` : ""}`,
    });

    res.status(201).json(savedSale);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── PUT /sales/:id ───────────────────────────────────────
router.put("/:id", async (req, res) => {
  try {
    const { items, discountType, discountValue } = req.body;
    if (!items || items.length === 0)
      return res.status(400).json({ message: "Sale must contain at least one product" });

    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ message: "Sale not found" });

    const oldTotalAmount = sale.totalAmount;

    for (const oldItem of sale.items) {
      const product = await Product.findById(oldItem.product);
      if (product) { product.stock += oldItem.quantity; await product.save(); }
    }

    let subtotal = 0, profit = 0;
    const newItems = [];

    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) return res.status(404).json({ message: "Product not found" });
      if (product.stock < item.quantity)
        return res.status(400).json({ message: `${product.name} has insufficient stock` });

      const itemTotal  = product.sellingPrice * item.quantity;
      const itemProfit = (product.sellingPrice - product.costPrice) * item.quantity;
      newItems.push({ product: product._id, quantity: item.quantity, sellingPrice: product.sellingPrice, costPrice: product.costPrice, total: itemTotal });
      subtotal += itemTotal; profit += itemProfit;
      product.stock -= item.quantity; await product.save();
    }

    // Keep existing discount unless a new one is explicitly provided
    const useDiscountType  = discountType  !== undefined ? discountType  : sale.discountType;
    const useDiscountValue = discountValue !== undefined ? discountValue : sale.discountValue;

    const { type: discType, value: discValue, amount: discountAmount } =
      resolveDiscount(useDiscountType, useDiscountValue, subtotal);

    const totalAmount = Math.round((subtotal - discountAmount) * 100) / 100;
    profit             = Math.round((profit - discountAmount) * 100) / 100;

    sale.items          = newItems;
    sale.subtotal        = subtotal;
    sale.discountType    = discType;
    sale.discountValue   = discValue;
    sale.discountAmount  = discountAmount;
    sale.totalAmount     = totalAmount;
    // If editing dropped the total below what was already paid, clamp it down
    // so amountPaid never exceeds the new totalAmount.
    if (sale.amountPaid > totalAmount) sale.amountPaid = totalAmount;
    sale.profit          = profit;
    await sale.save();

    if (sale.paymentType === "CREDIT" && sale.customer) {
      const customer = await Customer.findById(sale.customer);
      if (customer) { customer.dueAmount = customer.dueAmount - oldTotalAmount + totalAmount; await customer.save(); }
      await CustomerTransaction.findOneAndUpdate(
        { customer: sale.customer, type: "PURCHASE", note: `CREDIT Sale INV-${sale._id.toString().slice(-6).toUpperCase()}` },
        { amount: totalAmount }
      );
    }

    if (sale.paymentType === "CASH" && sale.customer) {
      // keep both legs of the customer's purchase history in sync with the
      // edited total, so the PURCHASE/PAYMENT pair still nets to zero due.
      const invNo = `INV-${sale._id.toString().slice(-6).toUpperCase()}`;
      await CustomerTransaction.findOneAndUpdate(
        { customer: sale.customer, type: "PURCHASE", note: `CASH Sale ${invNo}` },
        { amount: totalAmount }
      );
      await CustomerTransaction.findOneAndUpdate(
        { customer: sale.customer, type: "PAYMENT", note: `CASH Sale ${invNo} (paid in full)` },
        { amount: totalAmount }
      );
    }

    await AuditLog.create({ user: req.headers["x-user"] || "Unknown", action: "EDIT SALE", details: `Sale ${sale._id}` });
    res.json({ message: "Sale updated successfully", sale });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── DELETE /sales/:id ────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id).populate("items.product").populate("customer");
    if (!sale) return res.status(404).json({ message: "Sale not found" });

    for (const item of sale.items) {
      const product = await Product.findById(item.product);
      if (product) {
        product.stock += item.quantity; await product.save();
        await StockMovement.create({ product: product._id, type: "RETURN", quantity: item.quantity, note: `Sale Deleted INV-${sale._id.toString().slice(-6).toUpperCase()}` });
      }
    }

    if ((sale.paymentType === "CREDIT" || sale.paymentType === "CHEQUE") && sale.customer) {
      const customer = await Customer.findById(sale.customer._id);
      if (customer) { customer.dueAmount = Math.max(0, customer.dueAmount - sale.totalAmount); await customer.save(); }
      await CustomerTransaction.deleteOne({ customer: sale.customer._id, type: "PURCHASE", note: `${sale.paymentType} Sale INV-${sale._id.toString().slice(-6).toUpperCase()}` });
    }

    if (sale.paymentType === "CASH" && sale.customer) {
      const invNo = `INV-${sale._id.toString().slice(-6).toUpperCase()}`;
      await CustomerTransaction.deleteOne({ customer: sale.customer._id, type: "PURCHASE", note: `CASH Sale ${invNo}` });
      await CustomerTransaction.deleteOne({ customer: sale.customer._id, type: "PAYMENT", note: `CASH Sale ${invNo} (paid in full)` });
    }

    await Sale.findByIdAndDelete(req.params.id);
    const productSummary = sale.items.map(i => `${i.product.name} (${i.quantity})`).join(", ");
    await AuditLog.create({ user: req.headers["x-user"] || "Unknown", action: "DELETE SALE", details: `${sale.customer} | ${productSummary} | Rs.${sale.totalAmount}` });
    res.json({ message: "Sale deleted and stock restored" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── PUT /sales/:id/cheque-status ─────────────────────────
router.put("/:id/cheque-status", async (req, res) => {
  try {
    const { status } = req.body;
    if (!["PENDING", "CLEARED", "BOUNCED"].includes(status))
      return res.status(400).json({ message: "Invalid cheque status" });

    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ message: "Sale not found" });
    if (sale.paymentType !== "CHEQUE") return res.status(400).json({ message: "This is not a cheque sale" });

    const oldStatus = sale.chequeStatus;
    if (oldStatus === "CLEARED") return res.status(400).json({ message: "Cheque already cleared" });

    sale.chequeStatus = status;
    await sale.save();

    if (oldStatus === "PENDING" && status === "CLEARED" && sale.customer) {
      const customer = await Customer.findById(sale.customer);
      if (customer) { customer.dueAmount = Math.max(0, customer.dueAmount - sale.totalAmount); await customer.save(); }
      await CustomerTransaction.create({ customer: sale.customer, type: "PAYMENT", amount: sale.totalAmount, note: `Cheque Cleared INV-${sale._id.toString().slice(-6).toUpperCase()}` });
    }

    await AuditLog.create({ user: req.headers["x-user"] || "Unknown", action: "UPDATE CHEQUE STATUS", details: `Sale ${sale._id} -> ${status}` });
    res.json({ message: `Cheque marked as ${status}`, sale });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;