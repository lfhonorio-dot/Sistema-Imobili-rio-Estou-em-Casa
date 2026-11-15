import { HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { HttpExceptionFilter } from './http-exception.filter';

// Homologação: o limite de tentativas devolvia ao usuário a mensagem técnica em
// inglês "ThrottlerException: Too Many Requests".
function run(exception: HttpException) {
  const json = jest.fn();
  const res = { status: jest.fn(() => ({ json })) };
  const host = {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => ({ method: 'POST', path: '/api/v1/auth/login', url: '/api/v1/auth/login' }) }),
  };
  new HttpExceptionFilter().catch(exception, host as never);
  return { status: (res.status.mock.calls[0] as unknown[])[0], body: json.mock.calls[0][0] };
}

describe('HttpExceptionFilter', () => {
  it('limite de tentativas: 429 com mensagem em português', () => {
    const r = run(new ThrottlerException());
    expect(r.status).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(r.body.message).toBe('Muitas tentativas em pouco tempo. Aguarde um minuto e tente de novo.');
  });

  it('demais erros mantêm a mensagem específica', () => {
    const r = run(new BadRequestException('CPF inválido.'));
    expect(r.body.message).toBe('CPF inválido.');
  });
});
