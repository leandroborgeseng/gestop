import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedRequest } from './current-user';
import {
  hasAllPermissions,
  hasAnyPermission,
  REQUIRED_ANY_PERMISSIONS_KEY,
  REQUIRED_PERMISSIONS_KEY,
} from './permissions';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const requiredAll =
      this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    const requiredAny =
      this.reflector.getAllAndOverride<string[]>(REQUIRED_ANY_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (requiredAll.length === 0 && requiredAny.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (requiredAll.length > 0 && !hasAllPermissions(request.user, requiredAll)) {
      throw new ForbiddenException('Acesso negado para o perfil atual');
    }

    if (requiredAny.length > 0 && !hasAnyPermission(request.user, requiredAny)) {
      throw new ForbiddenException('Acesso negado para o perfil atual');
    }

    return true;
  }
}
