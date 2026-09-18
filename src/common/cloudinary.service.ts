import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { v4 as uuidv4 } from 'uuid';

type UploadedImage = {
  buffer: Buffer;
  mimetype?: string;
};

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private readonly configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
      secure: true,
      timeout: 60000, // 👈 زيادة المهلة إلى 60 ثانية بدلاً من الافتراضية (10-20 ثانية)
    });
  }

  async uploadImage(
    file: UploadedImage,
    folderName = 'gold_barcode_items',
    customPublicId?: string, // 👈 إضافة بارامتر مخصص لاسم الملف
  ): Promise<string> {
    if (!file || !file.mimetype?.startsWith('image/')) {
      throw new BadRequestException(
        'عذراً، الملف المرفوع يجب أن يكون صورة فقط',
      );
    }

    // إذا لم يتم تمرير ID مخصص، استخدم اسم فريد يعتمد على الوقت
    const publicId = customPublicId || `img_${Date.now()}`;

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folderName,
          public_id: publicId, // 👈 ضبط الـ public_id لمنع التكرار
          overwrite: true, // 👈 استبدال الملف القديم بنفس الاسم بدلاً من إنشاء واحد جديد
          resource_type: 'image',

          // 🚀 إعدادات الـ Optimization لتصغير الحجم لأقل كيلو بايت
          transformation: [
            { width: 1000, height: 1000, crop: 'limit' },
            { quality: 'auto:eco' },
            { fetch_format: 'auto' },
          ],
        },
        (error, result) => {
          if (error || !result) {
            this.logger.error(`Cloudinary Error: ${JSON.stringify(error)}`);
            return reject(
              new BadRequestException(`فشل رفع الصورة: ${error?.message}`),
            );
          }
          resolve(result.secure_url);
        },
      );

      uploadStream.end(file.buffer);
    });
  }

  // بقية الدوال كما هي...
}
