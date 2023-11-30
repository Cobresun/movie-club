import { v2 as cloudinary, UploadApiResponse } from "cloudinary";

const upload = async (file: Buffer) => {
  const uploadResponse = await new Promise<UploadApiResponse | undefined>(
    (resolve) => {
      cloudinary.uploader
        .upload_stream(
          {
            transformation: {
              width: 256,
              crop: "thumb",
              gravity: "face",
              aspect_ratio: "1.0",
            },
          },
          (error, uploadResult) => {
            return resolve(uploadResult);
          }
        )
        .end(file);
    }
  );

  return {
    url: uploadResponse?.secure_url,
    id: uploadResponse?.public_id,
  };
};

const destroy = async (id: string) => {
  return await cloudinary.uploader.destroy(id);
};

export default { upload, destroy };
