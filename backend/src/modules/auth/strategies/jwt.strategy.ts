// Estratégia JWT do Passport
// Extrai e valida o token JWT do header Authorization
// Verifica também se o token está na blacklist Redis

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { TokenBlacklistService } from '../../../security/token-blacklist.service';
import { JwtPayload } from '../../../common/decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private tokenBlacklist: TokenBlacklistService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET') || '',
      passReqToCallback: true, // Necessário para verificar blacklist
    });
  }

  // Valida o payload JWT e verifica blacklist
  async validate(req: Request, payload: JwtPayload): Promise<JwtPayload> {
    // Extrai o token do header para verificar na blacklist
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const isBlacklisted = await this.tokenBlacklist.isBlacklisted(token);
      if (isBlacklisted) {
        throw new UnauthorizedException(
          'Token revogado. Faça login novamente.',
        );
      }
    }

    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
    };
  }
}
