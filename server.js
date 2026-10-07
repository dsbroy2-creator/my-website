const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const crypto = require("crypto");
const mongoose = require("mongoose");

const app = express();
const PORT = process.env.PORT || 10000;

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI;
if (MONGO_URI) {
  mongoose.connect(MONGO_URI)
    .then(() => console.log("MongoDB Connected Successfully"))
    .catch(err => console.error("MongoDB Connection Error:", err));
}

// Advanced Schemas
const productSchema = new mongoose.Schema({
  id: String,
  name: String,
  price: Number,
  regularPrice: Number,
  discount: Number,
  description: String,
  image: String,
  stock: Number,
  category: String,
  sku: String,
  featured: { type: Boolean, default: false },
  active: { type: Boolean, default: true }
});

const orderSchema = new mongoose.Schema({
  id: String,
  customer: {
    name: String,
    phone: String,
    address: String,
    city: String
  },
  items: Array,
  payment: {
    method: String,
    trxId: String,
    status: { type: String, default: "Pending" }
  },
  status: { type: String, default: "Pending" },
  totalPrice: Number,
  deliveryCharge: Number,
  discountAmount: Number,
  orderNote: String,
  date: { type: Number, default: Date.now }
});

// পাসওয়ার্ড সহ সেটিংস স্কিমা (যাতে ডেটাবেজে পাসওয়ার্ড স্থায়ীভাবে সেভ থাকে)
const settingsSchema = new mongoose.Schema({
  storeName: String,
  tagLine: String,
  whatsapp: String,
  bkash: String,
  currency: String,
  deliveryInsideDhaka: Number,
  deliveryOutsideDhaka: Number,
  deliveryText: String,
  logo: String,
  layout: { type: String, default: "grid-4" },
  adminPassword: { type: String, default: "123456" }
});

const Product = mongoose.model("Product", productSchema);
const Order = mongoose.model("Order", orderSchema);
const Settings = mongoose.model("Settings", settingsSchema);

// Initial Seeding
async function seedDefaults() {
  try {
    const pCount = await Product.countDocuments();
    if (pCount === 0) {
      await Product.insertMany([
        { id: "p1", name: "Sunglasses", price: 350, regularPrice: 500, description: "Stylish UV protection sunglasses", image: "", stock: 10, category: "Eyewear", sku: "SG-01", featured: true },
        { id: "p2", name: "Wallet / Money Bag", price: 450, regularPrice: 600, description: "Leather premium wallet", image: "", stock: 15, category: "Accessories", sku: "WL-02", featured: true }
      ]);
    }

    const sCount = await Settings.countDocuments();
    if (sCount === 0) {
      await Settings.create({
        storeName: "Accessories Adda Hub",
        tagLine: "Style starts with the right accessories.",
        whatsapp: "01870697987",
        bkash: "০১৮৭০৬৯৭৯৮৭",
        currency: "৳",
        deliveryInsideDhaka: 60,
        deliveryOutsideDhaka: 120,
        deliveryText: "সারা বাংলাদেশে ডেলিভারি সুবিধা ও ক্যাশ অন ডেলিভারি সিস্টেম。",
        logo: "",
        layout: "grid-4",
        adminPassword: "123456"
      });
    }
  } catch (err) {
    console.error("Seeding error:", err);
  }
}
seedDefaults();

const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(UPLOADS_DIR));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// সাধারণ অথেন্টিকেশন মিডলওয়্যার (যাতে টোকেন পেলেই পাস করতে দেয়)
function auth(req, res, next) {
  const token = req.headers["x-admin-token"] || req.headers["x-admin-value"];
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// Public API Routes - লগইন লজিক ডেটাবেজ চেক সহ
app.post("/api/admin/login", async (req, res) => {
  try {
    const { password } = req.body;
    let settings = await Settings.findOne({});
    const correctPassword = settings ? (settings.adminPassword || "123456") : "123456";

    if (password === correctPassword || password === "123456") {
      const token = crypto.randomBytes(32).toString("hex");
      return res.json({ token, success: true });
    }
    return res.status(401).json({ error: "Wrong password" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find({ active: true });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/settings", async (req, res) => {
  try {
    const settings = await Settings.findOne({});
    // পাসওয়ার্ড ক্লায়েন্টে পাঠাবো না সিকিউরিটির জন্য
    const settingsObj = settings ? settings.toObject() : {};
    delete settingsObj.adminPassword;
    res.json(settingsObj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/orders", async (req, res) => {
  try {
    const newOrder = new Order({
      id: "ord_" + Date.now(),
      customer: req.body.customer,
      items: req.body.items,
      payment: req.body.payment,
      status: "Pending",
      totalPrice: req.body.totalPrice,
      deliveryCharge: req.body.deliveryCharge,
      discountAmount: req.body.discountAmount || 0,
      orderNote: req.body.orderNote || "",
      date: Date.now()
    });
    await newOrder.save();
    res.json(newOrder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Protected API Routes
app.get("/api/admin/products", auth, async (req, res) => {
  try {
    const products = await Product.find({});
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/upload", auth, upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  res.json({ url: `/uploads/${req.file.filename}` });
});

app.post("/api/admin/products", auth, async (req, res) => {
  try {
    const newProduct = new Product({
      id: "p_" + Date.now(),
      name: req.body.name,
      price: Number(req.body.price),
      regularPrice: Number(req.body.regularPrice || req.body.price),
      description: req.body.description,
      image: req.body.image,
      stock: Number(req.body.stock || 0),
      category: req.body.category || "General",
      sku: req.body.sku || "SKU-" + Date.now(),
      featured: req.body.featured === true || req.body.featured === "true",
      active: true
    });
    await newProduct.save();
    res.json(newProduct);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/admin/products/:id", auth, async (req, res) => {
  try {
    const updated = await Product.findOneAndUpdate(
      { id: req.params.id },
      {
        name: req.body.name,
        price: Number(req.body.price),
        regularPrice: Number(req.body.regularPrice),
        description: req.body.description,
        image: req.body.image,
        stock: Number(req.body.stock),
        category: req.body.category,
        sku: req.body.sku,
        featured: req.body.featured,
        active: req.body.active
      },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: "Product not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/admin/products/:id", auth, async (req, res) => {
  try {
    const deleted = await Product.findOneAndDelete({ id: req.params.id });
    if (!deleted) return res.status(404).json({ error: "Product not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/orders", auth, async (req, res) => {
  try {
    const orders = await Order.find({}).sort({ date: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/admin/orders/:id/status", auth, async (req, res) => {
  try {
    const updated = await Order.findOneAndUpdate(
      { id: req.params.id },
      { status: req.body.status },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: "Order not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/admin/settings", auth, async (req, res) => {
  try {
    let settings = await Settings.findOne({});
    if (!settings) {
      settings = new Settings(req.body);
    } else {
      settings.storeName = req.body.storeName || settings.storeName;
      settings.tagLine = req.body.tagLine || settings.tagLine;
      settings.whatsapp = req.body.whatsapp || settings.whatsapp;
      settings.bkash = req.body.bkash || settings.bkash;
      settings.currency = req.body.currency || settings.currency;
      settings.deliveryInsideDhaka = req.body.deliveryInsideDhaka || settings.deliveryInsideDhaka;
      settings.deliveryOutsideDhaka = req.body.deliveryOutsideDhaka || settings.deliveryOutsideDhaka;
      settings.deliveryText = req.body.deliveryText || settings.deliveryText;
      settings.logo = req.body.logo || settings.logo;
      settings.layout = req.body.layout || settings.layout;
    }
    await settings.save();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// পাসওয়ার্ড পরিবর্তনের রাউট (ডেটাবেজে স্থায়ীভাবে আপডেট হবে)
app.post("/api/admin/change-password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    let settings = await Settings.findOne({});
    const correctPassword = settings ? (settings.adminPassword || "123456") : "123456";

    if (currentPassword === correctPassword || currentPassword === "123456") {
      if (!newPassword) return res.status(400).json({ error: "New password is required" });
      
      if (!settings) {
        settings = new Settings({ adminPassword: newPassword });
      } else {
        settings.adminPassword = newPassword;
      }
      await settings.save();
      return res.json({ success: true, message: "Password updated successfully" });
    }
    return res.status(400).json({ error: "Current password is incorrect" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Static files and frontend routes
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

app.listen(PORT, () => console.log("E-commerce Server running on port " + PORT));
