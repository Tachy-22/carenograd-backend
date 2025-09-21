import { applyDecorators, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../guards/admin.guard';
import { ApiSecurity, ApiBearerAuth } from '@nestjs/swagger';

/**
 * Decorator that combines JWT authentication with admin role checking
 * Use this on endpoints that require admin access
 */
export function AdminOnly() {
  return applyDecorators(
    UseGuards(AuthGuard('jwt'), AdminGuard),
    ApiBearerAuth(),
    ApiSecurity('bearer')
  );
}