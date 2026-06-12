import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { isUuid } from './uuid';

@Injectable()
export class ParseUuidPipe implements PipeTransform<string, string> {
  transform(value: string) {
    if (!isUuid(value)) {
      throw new BadRequestException('Identificador inválido.');
    }
    return value.trim();
  }
}
