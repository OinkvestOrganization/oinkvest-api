export interface AiProviderInterface {
  generateResponse(prompt: string): Promise<any>;
}
