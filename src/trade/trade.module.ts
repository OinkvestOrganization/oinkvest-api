import { Module } from '@nestjs/common';
import { TradeService } from './trade.service';
import { TradeController } from './trade.controller';
import { BinanceModule } from '@/binance/binance.module';
import { WalletModule } from '@/wallet/wallet.module';

@Module({
  imports: [BinanceModule, WalletModule],
  providers: [TradeService],
  controllers: [TradeController],
  exports: [TradeService],
})
export class TradeModule {}
