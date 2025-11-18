import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { TradeService } from './trade.service';
import { BinanceModule } from '../binance/binance.module';

@Module({
  imports: [BinanceModule],
  controllers: [WalletController],
  providers: [WalletService, TradeService, PrismaService],
  exports: [WalletService, TradeService],
})
export class WalletModule {}
