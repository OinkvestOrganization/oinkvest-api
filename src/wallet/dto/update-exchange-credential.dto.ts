import { PartialType } from '@nestjs/swagger';
import { CreateExchangeCredentialDto } from './create-exchange-credential.dto';

export class UpdateExchangeCredentialDto extends PartialType(
  CreateExchangeCredentialDto,
) {}
