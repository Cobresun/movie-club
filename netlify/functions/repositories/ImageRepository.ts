import { v2 as cloudinary, UploadApiResponse } from "cloudinary";

class ImageRepository {
  async upload(file: Buffer) {
    const uploadResponse = await new Promise<UploadApiResponse | undefined>(
      (resolve) => {
        cloudinary.uploader
          .upload_stream(
            {
              transformation: {
                width: 256,
                crop: "thumb",
                gravity: "faces",
                aspect_ratio: "1.0",
              },
            },
            (error, uploadResult) => {
              return resolve(uploadResult);
            },
          )
          .end(file);
      },
    );

    return {
      url: uploadResponse?.secure_url,
      id: uploadResponse?.public_id,
    };
  }

  async destroy(id: string) {
    return await cloudinary.uploader.destroy(id);
  }
}

export default new ImageRepository();
