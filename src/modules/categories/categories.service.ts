import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category } from './schemas/category.schema';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name) public readonly categoryModel: Model<Category>,
  ) {}

  // 1. إنشاء تصنيف جديد
  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    const normalizedName = createCategoryDto.name.trim();

    const existing = await this.categoryModel.findOne({ name: normalizedName });
    if (existing) {
      throw new ConflictException('هذا التصنيف مسجل بالفعل في النظام');
    }

    const newCategory = new this.categoryModel({ name: normalizedName });
    return newCategory.save();
  }

  // 2. جلب التصنيفات بناءً على الحالة (نشط أو مؤرشف)
  async findAllActive(status: string = 'ACTIVE'): Promise<Category[]> {
    const isArchivedQuery = status.toUpperCase() === 'ARCHIVED';
    return this.categoryModel
      .find({ isArchived: isArchivedQuery })
      .sort({ createdAt: -1 })
      .exec();
  }

  // 3. تعديل اسم تصنيف أو استرجاعه من الأرشيف (Restore)
  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<Category> {
    const updateData: any = {};

    // أ) لو باعت اسم جديد، بنعمل الـ Validation بتاعه ونجهزه للتحديث
    if (updateCategoryDto.name) {
      const normalizedName = updateCategoryDto.name.trim();

      const existing = await this.categoryModel.findOne({
        name: normalizedName,
        _id: { $ne: id },
      });
      if (existing) {
        throw new ConflictException('يوجد تصنيف آخر مسجل بنفس هذا الاسم');
      }
      updateData.name = normalizedName;
    }

    // ب) لو باعت ميزة الاسترجاع أو الأرشفة عن طريق الـ status
    if (updateCategoryDto.status) {
      updateData.isArchived =
        updateCategoryDto.status.toUpperCase() === 'ARCHIVED';
    }

    // شيلنا قيد { isArchived: false } من الفلتر عشان نقدر نوصل للمستند حتى لو كان مؤرشفاً ونعمله Restore
    const updatedCategory = await this.categoryModel
      .findOneAndUpdate({ _id: id }, { $set: updateData }, { new: true })
      .exec();

    if (!updatedCategory) {
      throw new NotFoundException('التصنيف غير موجود في النظام');
    }

    return updatedCategory;
  }

  // 4. الحذف الناعم (Soft Delete)
  async softDelete(id: string): Promise<void> {
    const result = await this.categoryModel
      .updateOne({ _id: id, isArchived: false }, { isArchived: true })
      .exec();

    if (result.matchedCount === 0) {
      throw new NotFoundException('التصنيف غير موجود أو تم حذفه بالفعل');
    }
  }
}
