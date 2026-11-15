import { Transform } from 'class-transformer';

// Campo opcional deixado em branco na tela chega como '' (string vazia). Tratamos
// como "sem valor" (null): sem isso, validações como @IsEmail() recusavam o
// formulário inteiro só porque um campo opcional ficou vazio (ex.: cliente sem
// e-mail não podia ser cadastrado). Também alinha com a regra do projeto de
// gravar CPF/CNPJ/e-mail vazios como NULL (índices únicos parciais).
export const EmptyToNull = () =>
  Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : value));
