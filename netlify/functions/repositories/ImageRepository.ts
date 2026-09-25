import { v2 as cloudinary, UploadApiResponse } from "cloudinary";

class ImageRepository {
  async upload(file: Buffer) {
    const uploadResponse = await new Promise<UploadApiResponse | undefined>((resolve) => {
      cloudinary.uploader
        .upload_stream(
          {
            // The member framed the photo themselves when they cropped it, so
            // this only resizes — face-gravity cropping would re-frame it.
            transformation: {
              width: 256,
              height: 256,
              crop: "fill",
            },
          },
          (error, uploadResult) => {
            return resolve(uploadResult);
          },
        )
        .end(file);
    });

    return {
      url: uploadResponse?.secure_url,
      id: uploadResponse?.public_id,
    };
  }

  async destroy(id: string): Promise<void> {
    await cloudinary.uploader.destroy(id);
  }
}

export default new ImageRepository();
