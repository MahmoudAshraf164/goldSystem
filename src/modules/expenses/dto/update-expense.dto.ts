import { PartialType } from '@nestjs/swagger';
import { CreateExpenseDto } from './create-expense.dto';

// الـ PartialType هيخلي الـ customer والـ items اختياريين أوتوماتيك للتحديث
// والـ totalPrice مش موجود هنا نهائياً، بالتالي السيرفر آمن تماماً
export class UpdateExpenseDto extends PartialType(CreateExpenseDto) {}
