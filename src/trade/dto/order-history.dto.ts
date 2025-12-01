import { Decimal } from '@prisma/client/runtime/binary';

export class OrderHistoryItemDto {
  orderId: bigint;
  clientOrderId: string;
  symbol: string;
  side: string;
  type: string;
  status: string;
  quantity: Decimal;
  executedQty: Decimal;
  cumulativeQuoteQty: Decimal;
  createdAt: Date;
}

export class ListOrdersResponseDto {
  total: number;
  orders: OrderHistoryItemDto[];
}
