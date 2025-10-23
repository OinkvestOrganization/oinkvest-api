import { IsNumber, Max, Min } from 'class-validator';

class KlineSubscriptionDto {
  symbol: string;
  interval: string;
  @IsNumber()
  @Min(1)
  @Max(1000)
  limit: number;
}
export default KlineSubscriptionDto;
export { KlineSubscriptionDto };
