import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import { ScrapPurchasesService } from './scrap-purchases.service';
import { CreateScrapPurchaseDto } from './dto/create-scrap-purchases.dto';
import { UpdateScrapPurchaseDto } from './dto/update-scrap-purchases.dto';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('Scrap Purchases (دفتر شراء الذهب الكسر)')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Controller('scrap-purchases')
export class ScrapPurchasesController {
  constructor(private readonly scrapPurchasesService: ScrapPurchasesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.OWNER, Role.Employee)
  @ApiOperation({
    summary: 'تسجيل عملية شراء ذهب كسر جديدة وتسديد كاش الخزنة وزيادة المخزن',
  })
  async createPurchase(@Body() dto: CreateScrapPurchaseDto, @Req() req: any) {
    const userId = req.user.id;
    const purchase = await this.scrapPurchasesService.createPurchase(
      dto,
      userId,
    );
    return {
      message:
        'تم تسجيل عملية شراء الكسر، وخصم الكاش من الخزنة، وإضافة الوزن للمخزن بنجاح',
      data: purchase,
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(Role.OWNER, Role.Employee)
  @ApiOperation({ summary: 'عرض جميع عمليات شراء الكسر المسجلة' })
  async findAll() {
    const purchases = await this.scrapPurchasesService.findAll();
    return {
      message: 'تم جلب سجل مشتريات الذهب الكسر بنجاح',
      data: purchases,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.OWNER, Role.Employee)
  @ApiParam({ name: 'id', description: 'معرف العملية (ObjectId)' })
  @ApiOperation({ summary: 'عرض تفاصيل عملية شراء كسر معينة' })
  async findOne(@Param('id') id: string) {
    const purchase = await this.scrapPurchasesService.findOne(id);
    return {
      message: 'تم جلب تفاصيل العملية بنجاح',
      data: purchase,
    };
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.OWNER) // التعديل في الدفاتر حكر على المالك فقط لضبط الخزنة والذهب
  @ApiParam({ name: 'id', description: 'معرف الفاتورة المراد تعديلها' })
  @ApiOperation({
    summary: 'تعديل فاتورة شراء كسر وتحديث الخزنة ومخزون الذهب تلقائياً بالفرق',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateScrapPurchaseDto,
    @Req() req: any,
  ) {
    const userId = req.user.id;
    const updated = await this.scrapPurchasesService.updatePurchase(
      id,
      dto,
      userId,
    );
    return {
      message: 'تم تعديل الفاتورة وتعديل الخزنة والمخزن بالفرق بنجاح',
      data: updated,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.OWNER) // الحذف صيانة للمالك فقط
  @ApiParam({ name: 'id', description: 'معرف الفاتورة المراد حذفها' })
  @ApiOperation({
    summary: 'حذف فاتورة شراء كسر واسترداد الكاش للخزنة وخصم الوزن من المخزن',
  })
  async delete(@Param('id') id: string, @Req() req: any) {
    const userId = req.user.id;
    const result = await this.scrapPurchasesService.deletePurchase(id, userId);
    return {
      message: result.message,
    };
  }
}
