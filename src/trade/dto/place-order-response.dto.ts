import { Decimal } from '@prisma/client/runtime/binary';

export class PlaceOrderResponseDto {
  orderId: string | bigint;
  clientOrderId: string;
  symbol: string;
  side: string;
  type: string;
  status: string;
  quantity: Decimal;
  executedQty: Decimal;
  cumulativeQuoteQty?: Decimal;
  fills?: Array<{
    price: Decimal;
    qty: Decimal;
    commission: Decimal;
    commissionAsset: string;
  }>;
  transactTime: Date;
  createdAt?: Date;
}
