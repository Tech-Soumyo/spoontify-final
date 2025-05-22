import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { Readable } from "stream";

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

// Configure Multer to use memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype) {
      return cb(null, true);
    }
    cb(new Error("Only JPEG and PNG images are allowed"));
  },
});

// Helper to convert buffer to stream
function bufferToStream(buffer: Buffer) {
  const readable = new Readable();
  readable._read = () => {};
  readable.push(buffer);
  readable.push(null);
  return readable;
}

// Middleware wrapper for multer single file upload
const runMiddleware = (req: any, res: any, fn: any) =>
  new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      return result instanceof Error ? reject(result) : resolve(result);
    });
  });

export const POST = async (req: NextRequest) => {
  const formData = await req.formData();
  const file = formData.get("image") as File;

  if (!file) {
    return NextResponse.json({ error: "No image provided" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  try {
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "spoontify_chat", resource_type: "image" },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      bufferToStream(buffer).pipe(stream);
    });

    const imageUrl = (result as any).secure_url;
    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 }
    );
  }
};

// import { v2 as cloudinary } from "cloudinary";
// import { NextRequest, NextResponse } from "next/server";
// import { IncomingForm } from "formidable";
// import { Readable } from "stream";
// import fs from "fs";

// export const config = {
//   api: {
//     bodyParser: false, // Required for formidable
//   },
// };

// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
//   api_key: process.env.CLOUDINARY_API_KEY!,
//   api_secret: process.env.CLOUDINARY_API_SECRET!,
// });

// function bufferToStream(buffer: Buffer): Readable {
//   const stream = new Readable();
//   stream.push(buffer);
//   stream.push(null);
//   return stream;
// }

// export async function POST(req: NextRequest) {
//   try {
//     const form = new IncomingForm();

//     const data = await new Promise<{ file: any }>((resolve, reject) => {
//       form.parse(req as any, (err, fields, files) => {
//         if (err) return reject(err);
//         resolve({ file: files.image });
//       });
//     });

//     if (!data.file) {
//       return NextResponse.json({ error: "No image provided" }, { status: 400 });
//     }

//     const fileBuffer = fs.readFileSync(data.file[0].filepath);
//     const result = await new Promise((resolve, reject) => {
//       const stream = cloudinary.uploader.upload_stream(
//         { folder: "spoontify_chat", resource_type: "image" },
//         (error, result) => {
//           if (error) reject(error);
//           else resolve(result);
//         }
//       );
//       bufferToStream(fileBuffer).pipe(stream);
//     });

//     return NextResponse.json(
//       { imageUrl: (result as any).secure_url },
//       { status: 200 }
//     );
//   } catch (error) {
//     console.error("Upload error", error);
//     return NextResponse.json(
//       { error: "Failed to upload image" },
//       { status: 500 }
//     );
//   }
// }
