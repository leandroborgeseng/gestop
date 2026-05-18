import { Controller, Get } from '@nestjs/common';

@Controller()
export class RootController {
  @Get()
  getRoot() {
    return {
      status: 'ok',
      service: 'gestop-api',
      message: 'GestOP API online',
      health: '/health',
      docs: {
        login: 'POST /auth/login',
        cco: 'GET /operacional/resumo',
        mobile: 'GET /mobile/field-package',
      },
      timestamp: new Date().toISOString(),
    };
  }
}

@Controller('health')
export class HealthController {
  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'gestop-api',
      timestamp: new Date().toISOString(),
    };
  }
}
