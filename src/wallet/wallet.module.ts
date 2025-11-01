import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { BinanceModule } from '../binance/binance.module';

@Module({
  imports: [BinanceModule],
  controllers: [WalletController],
  providers: [WalletService, PrismaService],
  exports: [WalletService],
})
export class WalletModule {}
