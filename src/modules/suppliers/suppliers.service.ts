import {
  Injectable,
  BadRequestException,
  NotFoundException,
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
    if (!Types.ObjectId.isValid(dto.supplierId)) {
      throw new BadRequestException('معرف المورد غير صالح');
    }

    const supplier = await this.supplierModel.findById(dto.supplierId);
    if (!supplier) throw new NotFoundException('المورد غير موجود');

    let totalGoodsValue = 0;
    const totalGoodsWeightByKarat: Record<number, number> = {
      24: 0,
      21: 0,
      18: 0,
    };

    if (dto.receivedItems && dto.receivedItems.length > 0) {
      for (const item of dto.receivedItems) {
        totalGoodsValue += item.totalPrice;
        if (totalGoodsWeightByKarat[item.karat] !== undefined) {
          totalGoodsWeightByKarat[item.karat] += item.weight;
        }
      }
    }

    let totalPaymentsValue = 0;
    let cashOutflow = 0;

    if (dto.paymentDetails) {
      const cash = dto.paymentDetails.cashPaid || 0;
      const fee = dto.paymentDetails.manufacturingFeePaid || 0;
      cashOutflow = cash + fee;
      totalPaymentsValue += cashOutflow;

      if (
        dto.paymentDetails.scrapPaid &&
        dto.paymentDetails.scrapPaid.length > 0
      ) {
        for (const scrap of dto.paymentDetails.scrapPaid) {
          totalPaymentsValue += scrap.totalValue;

          await this.scrapGoldService.deductScrap(
            scrap.karat,
            scrap.weight,
            userId,
            `سداد ذهب كسر للمورد: ${supplier.name}`,
          );
        }
      }
    }

    if (cashOutflow > 0) {
      await this.safeService.deductCash(
        cashOutflow,
        `سداد نقدية/مصنعية للمورد: ${supplier.name}`,
        userId,
      );
    }

    const transaction = new this.transactionModel({
      supplierId: new Types.ObjectId(dto.supplierId),
      type: dto.type,
      receivedItems: dto.receivedItems || [],
      paymentDetails: dto.paymentDetails || {
        cashPaid: 0,
        scrapPaid: [],
        manufacturingFeePaid: 0,
      },
      actionBy: Types.ObjectId.isValid(userId)
        ? new Types.ObjectId(userId)
        : userId,
      notes: dto.notes,
    });
    await transaction.save();

    supplier.cashBalance += totalGoodsValue - totalPaymentsValue;

    for (const karatKey of [18, 21, 24]) {
      const weightReceived = totalGoodsWeightByKarat[karatKey] || 0;
      const propKey = `karat${karatKey}` as keyof typeof supplier.goldBalances;
      supplier.goldBalances[propKey] =
        (supplier.goldBalances[propKey] || 0) + weightReceived;
    }

    if (dto.paymentDetails?.scrapPaid) {
      for (const scrap of dto.paymentDetails.scrapPaid) {
        const propKey =
          `karat${scrap.karat}` as keyof typeof supplier.goldBalances;
        if (supplier.goldBalances[propKey] !== undefined) {
          supplier.goldBalances[propKey] -= scrap.weight;
        }
      }
    }

    await supplier.save();
    return transaction;
  }
}
