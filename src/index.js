const path = require("path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;

dotenv.config({ path: path.join(__dirname, "../.env"), override: true });

const connectDb = require("./config/db");

// Routes
const authRoutes = require("./routes/authRoutes");
const foodRoutes = require("./routes/foodRoutes");
const tableRoutes = require("./routes/tableRoutes");
const tableCatalogRoutes = require("./routes/tableCatalogRoutes");
const adminRoutes = require("./routes/adminRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const { authMiddleware } = require("./middlewares/auth");

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173", credentials: true }));
app.use(express.json());

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  storage: new CloudinaryStorage({
    cloudinary,
    params: {
      folder: "hotel-dine-in",
      allowed_formats: ["jpg", "png", "jpeg", "webp"]
    },
  }),
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/foods", foodRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/table", tableRoutes);
app.use("/api/table-catalog", tableCatalogRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationRoutes);

// Image Upload Route (Admin only)
app.post("/api/upload", authMiddleware, upload.single("image"), (req, res) => {
  res.json({ imageUrl: req.file.path });
});

// Health
app.get("/api/health", (_, res) => res.json({ message: "Hotel API is running" }));

// Error handling
app.use((error, req, res, next) => {
  res.status(500).json({ message: error.message || "Internal server error" });
});

// Start Server
connectDb().then(() => {
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
});
