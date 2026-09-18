import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Customer } from './schemas/customer.schema';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { Invoice } from '../sales/schemas/invoice.schema';
import { BullionSale } from '../bullion-sales/schemas/bullion-sale.schema';

@Injectable()
export class CustomersService {
  constructor(
    @InjectModel(Customer.name) public readonly customerModel: Model<Customer>,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<Invoice>,
    @InjectModel(BullionSale.name)
    private readonly bullionSaleModel: Model<BullionSale>,
  ) {}

  // 1. إنشاء عميل جديد
  async create(createCustomerDto: CreateCustomerDto): Promise<Customer> {
    const payload: any = { ...createCustomerDto };
    if (
      payload.phoneNumber &&
      typeof payload.phoneNumber === 'string' &&
      payload.phoneNumber.trim() !== ''
    ) {
      payload.phoneNumber = payload.phoneNumber.trim();
      const existing = await this.customerModel.findOne({
        phoneNumber: payload.phoneNumber,
      });
      if (existing) {
        throw new ConflictException(
          'رقم هاتف العميل هذا مسجل بالفعل لعميل آخر',
        );
      }
    } else {
      delete payload.phoneNumber;
    }
    const newCustomer = new this.customerModel(payload);
    return newCustomer.save();
  }

  // 2. جلب العملاء مع البحث والفلترة
  async findAll(
    status: string = 'ACTIVE',
    search?: string,
  ): Promise<Customer[]> {
    const queryStatus =
      status.toUpperCase() === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE';
    const filter: any = { status: queryStatus };

    if (search) {
      filter.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
      ];
    }

    return this.customerModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  // 3. جلب عميل محدد بالـ ID (تم إضافتها هنا لتفادي خطأ عدم وجودها)
  async findById(id: string): Promise<Customer> {
    const customer = await this.customerModel
      .findOne({ _id: id, status: 'ACTIVE' })
      .exec();
    if (!customer) {
      throw new NotFoundException('العميل غير موجود أو مؤرشف');
    }
    return customer;
  }

  // 4. جلب سجل الفواتير والمشتريات الكامل للعميل (جديد + سبايك)
  async getCustomerStatement(customerId: string) {
    const customer = await this.findById(customerId);

    // استخدام lean<any>() لتجاوز قيود الأنواع (TypeScript) مع حقول التواريخ
    const standardInvoices = (await this.invoiceModel
      .find({ customer: customerId })
      .populate('items.inventoryItem', 'title karat')
      .populate('soldBy', 'fullName role')
      .lean()
      .exec()) as any[];

    const bullionSales = (await this.bullionSaleModel
      .find({ customer: customerId })
      .populate('seller', 'fullName role')
      .lean()
      .exec()) as any[];

    const formattedStandard = standardInvoices.map((inv) => ({
      ...inv,
      invoiceType: 'STANDARD',
      displayNumber: inv.invoiceNumber,
      displayTotal: inv.totalPrice,
      displayWeight: inv.totalInvoiceNetWeight || 0,
      date: inv.createdAt,
    }));

    const formattedBullion = bullionSales.map((sale) => ({
      ...sale,
      invoiceType: 'BULLION',
      displayNumber: sale.invoiceNumber,
      displayTotal: sale.grandTotal,
      displayWeight: sale.totalGoldWeight || 0,
      date: sale.createdAt,
    }));

    const allInvoices = [...formattedStandard, ...formattedBullion].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    const completedStandard = standardInvoices.filter(
      (inv) => inv.status !== 'CANCELLED',
    );
    const completedBullion = bullionSales.filter(
      (sale) => sale.status !== 'CANCELLED',
    );

    const totalSpent =
      completedStandard.reduce((sum, inv) => sum + (inv.totalPrice || 0), 0) +
      completedBullion.reduce((sum, sale) => sum + (sale.grandTotal || 0), 0);

    const totalWeightBought =
      completedStandard.reduce(
        (sum, inv) => sum + (inv.totalInvoiceNetWeight || 0),
        0,
      ) +
      completedBullion.reduce(
        (sum, sale) => sum + (sale.totalGoldWeight || 0),
        0,
      );

    return {
      customer,
      summary: {
        totalInvoicesCount: allInvoices.length,
        totalSpentMoney: totalSpent,
        totalNetWeightBought: parseFloat(totalWeightBought.toFixed(3)),
      },
      invoices: allInvoices,
    };
  }

  // 5. تعديل بيانات عميل
  async update(
    id: string,
    updateCustomerDto: UpdateCustomerDto,
  ): Promise<Customer> {
    const payload: any = { ...updateCustomerDto };
    if (payload.phoneNumber !== undefined) {
      if (
        payload.phoneNumber &&
        typeof payload.phoneNumber === 'string' &&
        payload.phoneNumber.trim() !== ''
      ) {
        payload.phoneNumber = payload.phoneNumber.trim();
        const existing = await this.customerModel.findOne({
          phoneNumber: payload.phoneNumber,
          _id: { $ne: id },
        });
        if (existing) {
          throw new ConflictException(
            'رقم الهاتف الجديد مسجل بالفعل لعميل آخر',
          );
        }
      } else {
        delete payload.phoneNumber;
        const updatedCustomerUnset = await this.customerModel
          .findByIdAndUpdate(
            id,
            { $unset: { phoneNumber: 1 }, ...payload },
            { new: true },
          )
          .exec();
        if (!updatedCustomerUnset) {
          throw new NotFoundException('العميل غير موجود');
        }
        return updatedCustomerUnset;
      }
    }
    const updatedCustomer = await this.customerModel
      .findByIdAndUpdate(id, payload, { new: true })
      .exec();
    if (!updatedCustomer) {
      throw new NotFoundException('العميل غير موجود');
    }
    return updatedCustomer;
  }

  // 6. الحذف الناعم (الأرشفة)
  async softDelete(id: string): Promise<void> {
    const result = await this.customerModel.updateOne(
      { _id: id, status: 'ACTIVE' },
      { status: 'ARCHIVED' },
    );
    if (result.matchedCount === 0) {
      throw new NotFoundException('العميل غير موجود أو مؤرشف بالفعل');
    }
  }
}
