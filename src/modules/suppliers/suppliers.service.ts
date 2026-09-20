import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Supplier } from './schemas/supplier.schema';
import { SupplierTransaction } from './schemas/supplier-transaction.schema';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { RecordSupplierTransactionDto } from './dto/create-supplier-transaction.dto';
import { ScrapGoldService } from '../scrap-gold/scrap-gold.service';
import { SafeService } from '../safe/safe.service';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectModel(Supplier.name) private readonly supplierModel: Model<Supplier>,
    @InjectModel(SupplierTransaction.name)
    private readonly transactionModel: Model<SupplierTransaction>,
    private readonly scrapGoldService: ScrapGoldService,
    private readonly safeService: SafeService,
  ) {}

  async createSupplier(dto: CreateSupplierDto): Promise<Supplier> {
    const supplier = new this.supplierModel(dto);
    return supplier.save();
  }

  async getAllSuppliers(): Promise<Supplier[]> {
    return this.supplierModel.find().exec();
  }

  async getSupplierStatement(supplierId: string) {
    if (!Types.ObjectId.isValid(supplierId)) {
      throw new BadRequestException('معرف المورد غير صالح');
    }

    const supplier = await this.supplierModel.findById(supplierId).exec();
    if (!supplier) throw new NotFoundException('المورد غير موجود');

    const transactions = await this.transactionModel
      .find({ supplierId: new Types.ObjectId(supplierId) })
      .sort({ createdAt: -1 })
      .exec();

    return {
      supplier,
      currentOpenBalance: {
        cashBalance: supplier.cashBalance,
        goldBalances: supplier.goldBalances,
      },
      statementHistory: transactions,
    };
  }

  async updateSupplier(id: string, dto: UpdateSupplierDto): Promise<Supplier> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('معرف المورد غير صالح');
    }

    const updatedSupplier = await this.supplierModel
      .findByIdAndUpdate(id, dto, { new: true })
      .exec();

    if (!updatedSupplier) {
      throw new NotFoundException('المورد غير موجود');
    }

    return updatedSupplier;
  }

  async deleteSupplier(id: string): Promise<{ message: string }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('معرف المورد غير صالح');
    }

    const supplier = await this.supplierModel.findById(id).exec();
    if (!supplier) {
      throw new NotFoundException('المورد غير موجود');
    }

    const hasTransactions = await this.transactionModel.exists({
      supplierId: new Types.ObjectId(id),
    });

    if (hasTransactions) {
      throw new BadRequestException(
        'لا يمكن حذف المورد لوجود معاملات مالية سابقة مرتبطة به.',
      );
    }

    await this.supplierModel.findByIdAndDelete(id).exec();
    return { message: 'تم حذف المورد بنجاح' };
  }

  async recordTransaction(
    dto: RecordSupplierTransactionDto,
    userId: string,
  ): Promise<SupplierTransaction> {
    // 1. التحقق من المعرفات
    if (!Types.ObjectId.isValid(dto.supplierId)) {
      throw new BadRequestException('معرف المورد غير صالح');
    }

    if (!Types.ObjectId.isValid(userId)) {
      throw new UnauthorizedException('معرف المستخدم غير صالح');
    }

    const supplier = await this.supplierModel.findById(dto.supplierId);
    if (!supplier) throw new NotFoundException('المورد غير موجود');

    let totalManufacturingFeeCalculated = 0;
    const totalGoodsWeightByKarat: Record<number, number> = {
      24: 0,
      21: 0,
      18: 0,
    };

    // 2. حساب أوزان الذهب المستلمة + مصنعية الشغل الجديدة (حساب الأجر)
    if (dto.receivedItems && dto.receivedItems.length > 0) {
      for (const item of dto.receivedItems) {
        if (totalGoodsWeightByKarat[item.karat] !== undefined) {
          totalGoodsWeightByKarat[item.karat] += item.weight;
        }
        // المصنعية = وزن القطعة × أجر الجرام
        totalManufacturingFeeCalculated +=
          (item.manufacturingFeePerGram || 0) * item.weight;
      }
    }

    // 3. معالجة عمليات السداد (مصنعية كاش + ذهب كسر + كاش مقابل ذهب)
    let manufacturingFeePaid = 0;
    let cashPaidForGold = 0;
    let goldPriceForCash = 0;

    if (dto.paymentDetails) {
      manufacturingFeePaid = dto.paymentDetails.manufacturingFeePaid || 0;
      cashPaidForGold = dto.paymentDetails.cashPaidForGold || 0;
      goldPriceForCash = dto.paymentDetails.goldPriceForCashDeduction || 0;

      // أ) خصم الذهب الكسر المسدد للمورد من مخزن الكسر
      if (
        dto.paymentDetails.scrapPaid &&
        dto.paymentDetails.scrapPaid.length > 0
      ) {
        for (const scrap of dto.paymentDetails.scrapPaid) {
          await this.scrapGoldService.deductScrap(
            scrap.karat,
            scrap.weight,
            userId,
            `سداد ذهب كسر للمورد: ${supplier.name}`,
          );
        }
      }

      // ب) خصم النقدية من الخزنة (مصنعية كاش + كاش مقابل ذهب)
      const totalCashOutflow = manufacturingFeePaid + cashPaidForGold;
      if (totalCashOutflow > 0) {
        await this.safeService.deductCash(
          totalCashOutflow,
          `سداد مصنعية/كاش للمورد: ${supplier.name}`,
          userId,
        );
      }
    }

    // 4. حفظ الحركة في قاعدة البيانات
    const transaction = new this.transactionModel({
      supplierId: new Types.ObjectId(dto.supplierId),
      type: dto.type,
      receivedItems: dto.receivedItems || [],
      paymentDetails: dto.paymentDetails || {
        manufacturingFeePaid: 0,
        cashPaidForGold: 0,
        goldPriceForCashDeduction: 0,
        scrapPaid: [],
      },
      actionBy: new Types.ObjectId(userId),
      notes: dto.notes,
    });
    await transaction.save();

    // 5. 🎯 تحديث دفاتر المورد (فصل تام بين دفتر النقدية ودفتر الجرامات)

    // أ) **دفتر النقدية (المصنعية):**
    // يزيد بالمصنعية المستحقة عن الشغل الجديد، وينقص بما تم سداده نقداً للمصنعية
    supplier.cashBalance +=
      totalManufacturingFeeCalculated - manufacturingFeePaid;

    // ب) **دفتر الذهب (الجرامات لكل عيار):**
    // 1. زيادة رصيد الذهب بالوزن المستلم جديد
    for (const karatKey of [18, 21, 24]) {
      const weightReceived = totalGoodsWeightByKarat[karatKey] || 0;
      const propKey = `karat${karatKey}` as keyof typeof supplier.goldBalances;
      supplier.goldBalances[propKey] =
        (supplier.goldBalances[propKey] || 0) + weightReceived;
    }

    // 2. خصم الذهب الكسر المسدد للمورد من رصيده
    if (dto.paymentDetails?.scrapPaid) {
      for (const scrap of dto.paymentDetails.scrapPaid) {
        const propKey =
          `karat${scrap.karat}` as keyof typeof supplier.goldBalances;
        if (supplier.goldBalances[propKey] !== undefined) {
          supplier.goldBalances[propKey] -= scrap.weight;
        }
      }
    }

    // 3. في حالة السداد "كاش مقابل ذهب" (نادرة): نحول المبلغ لكُتل جرامات ونخصمها من عيار 21 تلقائياً
    if (cashPaidForGold > 0 && goldPriceForCash > 0) {
      const equivalentGoldWeight = cashPaidForGold / goldPriceForCash;
      supplier.goldBalances.karat21 -= equivalentGoldWeight;
    }

    await supplier.save();
    return transaction;
  }
}