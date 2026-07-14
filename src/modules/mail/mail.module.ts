import { Module } from '@nestjs/common';
import { MailService } from './mail.service';

@Module({
  providers: [MailService],
  exports: [MailService], // مهم جداً عشان الـ AuthModule يشوفه
})
export class MailModule {}
