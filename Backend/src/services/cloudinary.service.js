import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a base64 file to Cloudinary
 * @param {string} base64 - raw base64 string (no data URI prefix)
 * @param {string} mimeType - e.g. "image/png" or "application/pdf"
 * @param {string} fileName - original file name
 * @returns {Promise<{ url: string }>}
 */
export async function uploadToCloudinary(base64, mimeType, fileName) {
    const dataUri = `data:${mimeType};base64,${base64}`;

    const result = await cloudinary.uploader.upload(dataUri, {
        folder: "cognivra",
        resource_type: "auto",
        public_id: `${Date.now()}_${fileName.replace(/\s+/g, "_")}`,
    });

    return { url: result.secure_url };
}