import { IsString, IsDecimal, IsEnum, Matches } from 'class-validator';
import { OrderSide } from '../enums/order-side.enum';
import { OrderType } from '../enums/order-type.enum';

export class PlaceOrderDto {
  @IsString()
  @Matches(/^[A-Z]{6,10}$/, {
    message: 'Symbol must be uppercase (e.g., BTCUSDT)',
  })
  symbol: string;

  @IsEnum(OrderSide)
  side: OrderSide;

  @IsEnum(OrderType)
  type: OrderType = OrderType.MARKET;

  @IsDecimal({ decimal_digits: '1,8' }, { message: 'Invalid quantity format' })
  quantity?: string;

  @IsDecimal(
    { decimal_digits: '1,8' },
    { message: 'Invalid quoteOrderQty format' },
  )
  quoteOrderQty?: string;
}
