import { Module } from '@nestjs/common';
import { SymbolsService } from './symbols.service';
import { BinanceModule } from '@/binance/binance.module';
import { SymbolsController } from './symbols.controller';

@Module({
  imports: [BinanceModule],
  providers: [SymbolsService],
  controllers: [SymbolsController],
})
export class SymbolsModule {}
