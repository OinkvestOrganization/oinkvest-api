import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Torna o módulo global, disponível para toda a aplicação
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
