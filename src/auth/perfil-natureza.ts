import { JwtPayload } from './jwt';

export function isPerfilExterno(user: Pick<JwtPayload, 'perfilNatureza'>) {
  return user.perfilNatureza === 'EXTERNO';
}

export function isPerfilInterno(user: Pick<JwtPayload, 'perfilNatureza'>) {
  return !isPerfilExterno(user);
}
