import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') as string,
    });
  }

  async validate(payload: { sub: string; email: string; role: string }) {
    // التحقق من أن المستخدم ما زال موجوداً في الداتا بيز وحسابه نشط
    const user = await this.usersService.findById(payload.sub);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        'جلسة العمل غير صالحة أو الحساب تم إيقافه',
      );
    }

    // البيانات اللي هترجع هنا هتكون متاحة في request.user في أي مكان في السيستم
    return {
      id: user._id,
      email: user.email,
      role: user.role,
    };
  }
}
