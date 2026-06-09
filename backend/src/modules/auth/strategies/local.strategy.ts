// Estratégia Local do Passport para validação de email/senha
// Usada internamente antes de emitir o JWT

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'email', // Usa email em vez de username
      passwordField: 'password',
    });
  }

  // Valida credenciais email/senha
  async validate(email: string, password: string): Promise<unknown> {
    const user = await this.authService.validateCredentials(email, password);
    if (!user) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }
    return user;
  }
}
