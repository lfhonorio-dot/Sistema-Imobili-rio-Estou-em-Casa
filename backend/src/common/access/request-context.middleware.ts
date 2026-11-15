// Fase 7 — abre um contexto por requisição (preenchido pelo WorkspaceGuard
// com o membro e o papel), para os serviços aplicarem o escopo do Corretor.
import type { NextFunction, Request, Response } from 'express';
import { requestContext } from './access';

export function requestContextMiddleware(_req: Request, _res: Response, next: NextFunction) {
  requestContext.run({}, () => next());
}
