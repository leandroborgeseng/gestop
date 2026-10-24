import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';

type HttpLikeResponse = {
  status: (code: number) => HttpLikeResponse;
  json: (body: unknown) => void;
};

type HttpLikeRequest = {
  method: string;
  url: string;
};

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpException');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<HttpLikeResponse>();
    const request = ctx.getRequest<HttpLikeRequest>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? this.extractMessage(exception)
        : exception instanceof Error
          ? exception.message
          : 'Erro interno do servidor';

    if (status >= 500) {
      this.logger.error(`${request.method} ${request.url} -> ${message}`, exception instanceof Error ? exception.stack : undefined);
    } else if (status >= 400) {
      this.logger.warn(`${request.method} ${request.url} -> ${status} ${message}`);
    }

    // 304/O6: `codigo` opcional (ex.: PROGRAMACAO_JA_BAIXADA) repassado para o app distinguir o conflito.
    const payload = exception instanceof HttpException ? exception.getResponse() : null;
    const codigo =
      payload && typeof payload === 'object' && typeof (payload as { codigo?: unknown }).codigo === 'string'
        ? (payload as { codigo: string }).codigo
        : undefined;

    response.status(status).json({
      statusCode: status,
      message,
      ...(codigo ? { codigo } : {}),
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private extractMessage(exception: HttpException) {
    const payload = exception.getResponse();
    if (typeof payload === 'string') return payload;
    if (payload && typeof payload === 'object' && 'message' in payload) {
      const message = (payload as { message?: string | string[] }).message;
      return Array.isArray(message) ? message.join(', ') : message ?? exception.message;
    }
    return exception.message;
  }
}
