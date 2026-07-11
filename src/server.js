require("dotenv").config();

const express = require("express");
const cors = require("cors");

const connectDB = require("./config/db");

const path = require("path");
const productRoutes = require("./routes/productRoutes");
const purchaseRoutes = require("./routes/purchaseRoutes");
const saleRoutes = require("./routes/saleRoutes");
const customerRoutes = require("./routes/customerRoutes");
const customerTransactionRoutes = require("./routes/customerTransactionRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const reportRoutes = require("./routes/reportRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const supplierRoutes = require("./routes/supplierRoutes");
const settingRoutes = require("./routes/settingRoutes");
const supplierTransactionRoutes = require("./routes/supplierTransactionRoutes");
const saleReturnRoutes = require("./routes/saleReturnRoutes");
const backupRoutes = require("./routes/backupRoutes");
const auditLogRoutes = require("./routes/auditLogRoutes");
const stockMovementRoutes = require("./routes/stockMovementRoutes");

const app = express();

// Connect Database
connectDB();

// Middleware
// app.use(
//   cors({
//     origin: "https://store-management-livid-eight.vercel.app",
//     credentials: true,
//   }),
// );

// app.use(cors({
//   origin: [
//     "https://store-management-livid-eight.vercel.app"
//   ]
// }));

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://store-management-livid-eight.vercel.app",
      "https://merokarobar-lyart.vercel.app",
    ],
    credentials: true,
  }),
);

app.use(express.json());

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Routes
app.use("/api/products", productRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/sales", saleRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/settings", settingRoutes);

app.use("/api/customer-transactions", customerTransactionRoutes);

app.use("/api/supplier-transactions", supplierTransactionRoutes);

app.use("/api/sale-returns", saleReturnRoutes);

app.use("/api/suppliers", supplierRoutes);

app.use("/api/expenses", expenseRoutes);

app.use("/api/reports", reportRoutes);

app.use("/api/users", userRoutes);

app.use("/api/backup", backupRoutes);

app.use("/api/audit-logs", auditLogRoutes);

app.use("/api/stock-movements", stockMovementRoutes);

// Home Route
app.get("/", (req, res) => {
  res.send("Store Management Backend Running");
});

// Start Server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
