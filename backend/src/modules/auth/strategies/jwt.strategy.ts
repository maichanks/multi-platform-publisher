import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getJwtSecret(),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any) {
    // You can add additional validation here (e.g., check if user is deleted)
    const { sub: userId, email } = payload;

    if (!userId) {
      throw new UnauthorizedException();
    }

    // The user object is attached to the request
    // Return only the essential user data to be attached to req.user
    return {
      id: userId,
      email,
    };
  }
}
