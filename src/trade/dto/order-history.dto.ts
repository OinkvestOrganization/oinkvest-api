export class OrderHistoryItemDto {
  orderId: string;
  clientOrderId: string;
  symbol: string;
  side: string;
  type: string;
  status: string;
  quantity: string;
  executedQty: string;
  cumulativeQuoteQty: string;
  createdAt: Date;
}

export class ListOrdersResponseDto {
  total: number;
  orders: OrderHistoryItemDto[];
}
