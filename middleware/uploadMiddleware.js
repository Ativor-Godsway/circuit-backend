import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";

// Store file in memory first, then upload to Cloudinary manually
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only jpg, png, webp images allowed"));
    }
  },
});

// Call this after upload middleware to push file to Cloudinary
export const uploadToCloudinary = (buffer, folder = "circuit") => {
  // Config runs here now, not at file import time
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        transformation: [{ quality: "auto", fetch_format: "auto" }],
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      },
    );
    Readable.from(buffer).pipe(stream);
  });
};
