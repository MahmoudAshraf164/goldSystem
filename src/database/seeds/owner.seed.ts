import * as mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import { UserSchema } from '../../modules/users/schemas/user.schema';
import { Role } from '../../common/enums/role.enum';

// تحميل ملف البيئة ديناميكياً بناءً على NODE_ENV
dotenv.config({
  path: `.env.${process.env.NODE_ENV ?? 'development'}`,
});

async function seed() {
  const uri = process.env.MONGO_URI;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!uri)
    throw new Error('MONGO_URI is not defined in environment variables');
  if (!email || !password)
    throw new Error('ADMIN_EMAIL or ADMIN_PASSWORD is missing');

  console.log('⏳ Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB successfully');

  // ربط الموديل بكولكشن الـ users الفعلي للسيستم
  const UserModel = mongoose.model('User', UserSchema, 'users');

  // التحقق من وجود مالك للنظام مسبقاً لحماية البيانات
  const existingOwner = await UserModel.findOne({ role: Role.OWNER });

  if (existingOwner) {
    console.log(
      '⚠️ System Owner already exists in the database. Seed aborted.',
    );
    await mongoose.disconnect();
    return;
  }

  // تشفير كلمة المرور بقوة 12 جولة
  const hashedPassword = await bcrypt.hash(password, 12);

  // إنشاء حساب المالك الأساسي بالحقول المطابقة تماماً للـ Schema
  await UserModel.create({
    fullName: 'صاحب المحل الأساسي',
    email: email.toLowerCase().trim(),
    passwordHash: hashedPassword,
    phoneNumber: '01000000000',
    role: Role.OWNER,
    status: 'ACTIVE',
    otpAttempts: 0,
  });

  console.log('===================================================');
  console.log('✅ Global System Owner Created Successfully!');
  console.log(`📧 Email: ${email}`);
  console.log('🔑 Password: [SECURED FROM ENV]');
  console.log(
    '⚠️ Please ensure to clear credentials from ENV if in production!',
  );
  console.log('===================================================');

  await mongoose.disconnect();
  console.log('🔌 Disconnected from MongoDB');
}

seed().catch((err) => {
  console.error('❌ Seed execution failed:', err);
  process.exit(1);
});

//  npx ts-node src/database/seeds/owner.seed.ts    
