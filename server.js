const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const crypto = require("crypto");
const mongoose = require("mongoose");

const app = express();
const PORT = process.env.PORT || 10000;

// ===============================
// MongoDB
// ===============================
const MONGO_URI = process.env.MONGO_URI;

if (MONGO_URI) {
  mongoose.connect(MONGO_URI)
    .then(() => {
      console.log("MongoDB Connected Successfully");
      seedDefaults();
    })
    .catch(err => {
      console.error("MongoDB Connection Error:", err);
    });
} else {
  console.error("MONGO_URI is missing.");
}

// ===============================
// Schemas
// ===============================

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
  layout: { type: String, default: "grid-4" }
});

// আলাদা Admin Password Collection
const adminSchema = new mongoose.Schema({
  username: {
    type: String,
    default: "admin",
    unique: true
  },
  passwordHash: {
    type: String,
    required: true
  }
});

const Product = mongoose.model("Product", productSchema);
const Order = mongoose.model("Order", orderSchema);
const Settings = mongoose.model("Settings", settingsSchema);
const Admin = mongoose.model("Admin", adminSchema);

// ===============================
// Password Functions
// ===============================

const DEFAULT_ADMIN_PASSWORD = "Mahir@786";

function hashPassword(password) {
  return crypto
    .createHash("sha256")
    .update(password)
    .digest("hex");
}

async function getAdmin() {
  return await Admin.findOne({ username: "admin" });
}

async function createDefaultAdmin() {
  try {
    const existing = await getAdmin();

    if (!existing) {
      await Admin.create({
        username: "admin",
        passwordHash: hashPassword(DEFAULT_ADMIN_PASSWORD)
      });

      console.log("Default admin created.");
    }
  } catch (err) {
    console.error("Admin seed error:", err);
  }
}

// ===============================
// Initial Seeding
// ===============================

async function seedDefaults() {
  try {
    const pCount = await Product.countDocuments();

    if (pCount === 0) {
      await Product.insertMany([
        {
          id: "p1",
          name: "Sunglasses",
          price: 350,
          regularPrice: 500,
          discount: 150,
          description: "Stylish UV protection sunglasses",
          image: "",
          stock: 10,
          category: "Eyewear",
          sku: "SG-01",
          featured: true,
          active: true
        },
        {
          id: "p2",
          name: "Wallet / Money Bag",
          price: 450,
          regularPrice: 600,
          discount: 150,
          description: "Leather premium wallet",
          image: "",
          stock: 15,
          category: "Accessories",
          sku: "WL-02",
          featured: true,
          active: true
        }
      ]);
    }

    const sCount = await Settings.countDocuments();

    if (sCount === 0) {
      await Settings.create({
        storeName: "Accessories Adda Hub",
        tagLine: "Style starts with the right accessories.",
        whatsapp: "01870697987",
        bkash: "01870697987",
        currency: "৳",
        deliveryInsideDhaka: 60,
        deliveryOutsideDhaka: 120,
        deliveryText: "সারা বাংলাদেশে ডেলিভারি সুবিধা ও ক্যাশ অন ডেলিভারি সিস্টেম।",
        logo: "",
        layout: "grid-4"
      });
    }

    await createDefaultAdmin();

    console.log("Default data ready.");
  } catch (err) {
    console.error("Seeding error:", err);
  }
}

// ===============================
// Uploads
// ===============================

const UPLOADS_DIR = path.join(__dirname, "uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(UPLOADS_DIR));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = Date.now() + "-" + crypto.randomBytes(5).toString("hex") + ext;

    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

// ===============================
// Login Sessions
// ===============================

const activeTokens = new Set();

// ===============================
// Authentication
// ===============================

async function auth(req, res, next) {
  const token = req.headers["x-admin-token"];

  if (!token || !activeTokens.has(token)) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Admin login required"
    });
  }

  next();
}

// ===============================
// ADMIN LOGIN
// ===============================

app.post("/api/admin/login", async (req, res) => {
  try {
    const password = String(req.body.password || "");

    if (!password) {
      return res.status(400).json({
        error: "Password is required"
      });
    }

    const admin = await getAdmin();

    if (!admin) {
      return res.status(500).json({
        error: "Admin account is not initialized"
      });
    }

    const passwordHash = hashPassword(password);

    if (passwordHash !== admin.passwordHash) {
      return res.status(401).json({
        error: "Wrong password"
      });
    }

    const token = crypto.randomBytes(32).toString("hex");

    activeTokens.add(token);

    res.json({
      success: true,
      token
    });

  } catch (err) {
    console.error("Login error:", err);

    res.status(500).json({
      error: "Login failed"
    });
  }
});

// ===============================
// ADMIN LOGOUT
// ===============================

app.post("/api/admin/logout", auth, (req, res) => {
  const token = req.headers["x-admin-token"];

  activeTokens.delete(token);

  res.json({
    success: true
  });
});

// ===============================
// CHECK LOGIN
// ===============================

app.get("/api/admin/check", auth, (req, res) => {
  res.json({
    success: true,
    loggedIn: true
  });
});

// ===============================
// PUBLIC PRODUCTS
// ===============================

app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find({
      active: true
    });

    res.json(products);

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// ===============================
// PUBLIC SETTINGS
// ===============================

app.get("/api/settings", async (req, res) => {
  try {
    const settings = await Settings.findOne({});

    res.json(settings || {});

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// ===============================
// PUBLIC ORDER
// ===============================

app.post("/api/orders", async (req, res) => {
  try {
    const newOrder = new Order({
      id: "ord_" + Date.now(),
      customer: req.body.customer,
      items: req.body.items || [],
      payment: req.body.payment || {},
      status: "Pending",
      totalPrice: Number(req.body.totalPrice || 0),
      deliveryCharge: Number(req.body.deliveryCharge || 0),
      discountAmount: Number(req.body.discountAmount || 0),
      orderNote: req.body.orderNote || "",
      date: Date.now()
    });

    await newOrder.save();

    res.json(newOrder);

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// ===============================
// ADMIN PRODUCTS
// ===============================

app.get("/api/admin/products", auth, async (req, res) => {
  try {
    const products = await Product.find({}).sort({ _id: -1 });

    res.json(products);

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// ===============================
// IMAGE UPLOAD
// ===============================

app.post("/api/admin/upload", auth, upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      error: "No file uploaded"
    });
  }

  res.json({
    success: true,
    url: "/uploads/" + req.file.filename
  });
});

// ===============================
// ADD PRODUCT
// ===============================

app.post("/api/admin/products", auth, async (req, res) => {
  try {
    const price = Number(req.body.price || 0);
    const regularPrice = Number(
      req.body.regularPrice || price
    );

    const newProduct = new Product({
      id: "p_" + Date.now(),

      name: req.body.name,

      price,

      regularPrice,

      discount: Math.max(regularPrice - price, 0),

      description: req.body.description || "",

      image: req.body.image || "",

      stock: Number(req.body.stock || 0),

      category: req.body.category || "General",

      sku: req.body.sku || "SKU-" + Date.now(),

      featured:
        req.body.featured === true ||
        req.body.featured === "true",

      active: true
    });

    await newProduct.save();

    res.json(newProduct);

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// ===============================
// UPDATE PRODUCT
// ===============================

app.put("/api/admin/products/:id", auth, async (req, res) => {
  try {
    const price = Number(req.body.price || 0);

    const regularPrice = Number(
      req.body.regularPrice || price
    );

    const updated = await Product.findOneAndUpdate(
      {
        id: req.params.id
      },
      {
        name: req.body.name,

        price,

        regularPrice,

        discount: Math.max(regularPrice - price, 0),

        description: req.body.description || "",

        image: req.body.image || "",

        stock: Number(req.body.stock || 0),

        category: req.body.category || "General",

        sku: req.body.sku || "",

        featured:
          req.body.featured === true ||
          req.body.featured === "true",

        active:
          req.body.active !== false &&
          req.body.active !== "false"
      },
      {
        new: true
      }
    );

    if (!updated) {
      return res.status(404).json({
        error: "Product not found"
      });
    }

    res.json(updated);

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// ===============================
// DELETE PRODUCT
// ===============================

app.delete("/api/admin/products/:id", auth, async (req, res) => {
  try {
    const deleted = await Product.findOneAndDelete({
      id: req.params.id
    });

    if (!deleted) {
      return res.status(404).json({
        error: "Product not found"
      });
    }

    res.json({
      success: true
    });

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// ===============================
// ADMIN ORDERS
// ===============================

app.get("/api/admin/orders", auth, async (req, res) => {
  try {
    const orders = await Order.find({})
      .sort({ date: -1 });

    res.json(orders);

  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

// ===============================
// UPDATE ORDER STATUS
// ===============================

app.put("/api/admin/orders/:id/status", auth, async (req, res) => {
  try {
    const allowedStatuses = [
      "Pending",
      "Confirmed",
      "Processing",
      "Shipped",
      "Delivered",
      "Cancelled"
    ];

    const status = req.body.status;

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: "Invalid order status"
      });
    }

    const updated = await Order.findOneAndUpdate(
      {
        id: req.params.id
      },
      {
        status
      },
      {
        new: true
      }
    );

    if (!updated) {
      return res.status(404).json({
        error: "Order not found"
      });
    }

    res.json(updated);

  } catch (err) {
    res.status(
