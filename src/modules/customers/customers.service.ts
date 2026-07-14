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
import { Invoice } from '../sales/schemas/invoice.schema'; // 👈 استيراد موديل الفواتير لربط السجل

@Injectable()
export class CustomersService {
  constructor(
    @InjectModel(Customer.name) public readonly customerModel: Model<Customer>,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<Invoice>, // 👈 حقن موديل الفواتير
  ) {}

  // 1. إنشاء عميل جديد
  async create(createCustomerDto: CreateCustomerDto): Promise<Customer> {
    const { phoneNumber } = createCustomerDto;

    const existing = await this.customerModel.findOne({
      phoneNumber: phoneNumber.trim(),
    });
    if (existing) {
      throw new ConflictException('رقم هاتف العميل هذا مسجل بالفعل في النظام');
    }

    const newCustomer = new this.customerModel({
      ...createCustomerDto,
      phoneNumber: phoneNumber.trim(),
    });

    return newCustomer.save();
  }

  // 2. جلب العملاء بناءً على الحالة النشطة أو المؤرشفة
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

  // 3. جلب عميل محدد بالـ ID
  async findById(id: string): Promise<Customer> {
    const customer = await this.customerModel
      .findOne({ _id: id, status: 'ACTIVE' })
      .exec();
    if (!customer) {
      throw new NotFoundException('العميل غير موجود أو مؤرشف');
    }
    return customer;
  }

  // 4. جلب سجل الفواتير والمشتريات الكامل للعميل (Customer Statement) 👈 الدالة الجديدة
  async getCustomerStatement(customerId: string) {
    // أ) نتأكد إن العميل موجود أولاً
    const customer = await this.findById(customerId);

    // ب) نجلب كل الفواتير المربوطة بالعميل ده (سواء مكتملة أو ملغية عشان مراجعة الحسابات)
    const invoices = await this.invoiceModel
      .find({ customer: customerId })
      .populate('items.inventoryItem', 'title karat') // جلب عيار واسم القطعة المشتراة
      .populate('soldBy', 'fullName role') // جلب اسم اللي باع له الفاتورة
      .sort({ createdAt: -1 }) // من الأحدث للأقدم
      .exec();

    // ج) حسبة سريعة لـ إجمالي ما أنفقه العميل في المحل وإجمالي الأوزان لتقديم تقرير ذكي للفرونتد
    const totalSpent = invoices
      .filter((inv) => inv.status === 'COMPLETED')
      .reduce((sum, inv) => sum + inv.totalPrice, 0);

    const totalWeightBought = invoices
      .filter((inv) => inv.status === 'COMPLETED')
      .reduce((sum, inv) => sum + inv.totalInvoiceNetWeight, 0);

    return {
      customer,
      summary: {
        totalInvoicesCount: invoices.length,
        totalSpentMoney: totalSpent,
        totalNetWeightBought: parseFloat(totalWeightBought.toFixed(3)),
      },
      invoices, // مصفوفة الفواتير الكاملة بقطعها
    };
  }

  // 5. تعديل بيانات عميل
  async update(
    id: string,
    updateCustomerDto: UpdateCustomerDto,
  ): Promise<Customer> {
    if (updateCustomerDto.phoneNumber) {
      const existing = await this.customerModel.findOne({
        phoneNumber: updateCustomerDto.phoneNumber.trim(),
        _id: { $ne: id },
      });
      if (existing) {
        throw new ConflictException('رقم الهاتف الجديد محجوز لعميل آخر');
      }
    }

    const updatedCustomer = await this.customerModel
      .findByIdAndUpdate(id, updateCustomerDto, { new: true })
      .exec();

    if (!updatedCustomer) {
      throw new NotFoundException('العميل غير موجود');
    }

    return updatedCustomer;
  }

  // 6. الحذف الناعم (أرشفة العميل)
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
