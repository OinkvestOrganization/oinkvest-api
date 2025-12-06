export class PlaceOrderResponseDto {
  orderId: string;
  clientOrderId: string;
  symbol: string;
  side: string;
  type: string;
  status: string;
  quantity: string;
  executedQty: string;
  cumulativeQuoteQty?: string;
  fills?: Array<{
    price: string;
    qty: string;
    commission: string;
    commissionAsset: string;
  }>;
  transactTime: Date;
  createdAt?: Date;
}
