import {
  IsString,
  IsOptional,
  IsEnum,
  Matches,
  ValidateIf,
} from 'class-validator';
import { OrderSide } from '../enums/order-side.enum';

export class PlaceOrderDto {
  @IsString()
  @Matches(/^[A-Z]{6,10}$/, {
    message: 'Symbol must be uppercase (e.g., BTCUSDT)',
  })
  symbol: string;

  @IsEnum(OrderSide)
  side: OrderSide;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,8})?$/, {
    message: 'Quantity must be a valid decimal (e.g., 0.001 or 100)',
  })
  quantity?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d{1,8})?$/, {
    message: 'QuoteOrderQty must be a valid decimal (e.g., 45.50)',
  })
  quoteOrderQty?: string;
}
