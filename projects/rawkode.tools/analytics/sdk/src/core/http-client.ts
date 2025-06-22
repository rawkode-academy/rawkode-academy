import type { CloudEvent } from 'cloudevents';
import type { BatchRequest, BatchResponse, ErrorResponse, RetryableError } from '../types';
import { compress } from '../utils/compression';
import { withRetry } from '../utils/retry';
import { Logger } from '../utils/logger';

export interface HttpClientOptions {
  endpoint: string;
  headers?: Record<string, string>;
  enableCompression: boolean;
  maxRetries: number;
  retryDelay: number;
  maxRetryDelay: number;
  logger: Logger;
}

export class HttpClient {
  constructor(private readonly options: HttpClientOptions) {}

  async sendBatch(events: CloudEvent[]): Promise<BatchResponse> {
    const batchRequest: BatchRequest = { events };
    
    return withRetry(
      () => this.sendRequest(batchRequest),
      {
        maxRetries: this.options.maxRetries,
        retryDelay: this.options.retryDelay,
        maxRetryDelay: this.options.maxRetryDelay,
        onRetry: (error, attempt) => {
          this.options.logger.warn(`Retry attempt ${attempt}`, error);
        }
      }
    );
  }

  private async sendRequest(batch: BatchRequest): Promise<BatchResponse> {
    const body = JSON.stringify(batch);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.options.headers
    };

    let requestBody: string | Uint8Array = body;

    if (this.options.enableCompression) {
      try {
        requestBody = await compress(body);
        headers['Content-Encoding'] = 'gzip';
        headers['Content-Type'] = 'application/octet-stream';
      } catch (error) {
        this.options.logger.warn('Compression failed, sending uncompressed', error);
      }
    }

    const response = await fetch(this.options.endpoint, {
      method: 'POST',
      headers,
      body: requestBody,
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData: ErrorResponse | null = null;
      
      try {
        errorData = JSON.parse(errorText) as ErrorResponse;
      } catch {
        // Not JSON, use raw text
      }

      const error = new Error(
        errorData?.error || `HTTP ${response.status}: ${response.statusText}`
      ) as RetryableError;
      
      error.statusCode = response.status;
      error.retryable = response.status >= 500 || response.status === 429;
      
      throw error;
    }

    return response.json() as Promise<BatchResponse>;
  }
}