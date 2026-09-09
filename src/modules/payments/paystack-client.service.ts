import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: {
    /** Known values: 'success' | 'failed' | 'abandoned' — typed as `string` since Paystack may add others. */
    status: string;
    reference: string;
    amount: number; // kobo
    currency: string;
    channel: string | null;
    gateway_response: string | null;
    paid_at: string | null;
    metadata: Record<string, unknown> | null;
  };
}

/**
 * Thin, typed wrapper around the two Paystack Checkout REST calls this app
 * needs. Uses Node's built-in `fetch` (no axios dependency) with a request
 * timeout via AbortController. Amount is converted to kobo only here — every
 * other layer of this app deals in Naira (numeric(14,2)), matching the
 * codebase-wide monetary convention.
 */
@Injectable()
export class PaystackClientService {
  private readonly logger = new Logger(PaystackClientService.name);
  private readonly baseUrl: string;
  private readonly secretKey: string;
  readonly publicKey: string;
  private readonly timeoutMs = 15_000;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>('PAYSTACK_BASE_URL') ||
      'https://api.paystack.co';
    const secretKey = this.configService.get<string>('PAYSTACK_SECRET_KEY');
    if (!secretKey) {
      throw new Error(
        'PAYSTACK_SECRET_KEY is not configured — see .env.example',
      );
    }
    this.secretKey = secretKey;
    this.publicKey =
      this.configService.get<string>('PAYSTACK_PUBLIC_KEY') ?? '';
  }

  static toKobo(nairaAmount: number): number {
    return Math.round(nairaAmount * 100);
  }

  static toNaira(koboAmount: number): number {
    return koboAmount / 100;
  }

  async initializeTransaction(params: {
    email: string;
    amountNaira: number;
    reference: string;
    callbackUrl?: string;
    metadata?: Record<string, unknown>;
  }): Promise<PaystackInitializeResponse> {
    return this.request<PaystackInitializeResponse>(
      '/transaction/initialize',
      'POST',
      {
        email: params.email,
        amount: PaystackClientService.toKobo(params.amountNaira),
        reference: params.reference,
        callback_url: params.callbackUrl,
        metadata: params.metadata,
      },
    );
  }

  async verifyTransaction(reference: string): Promise<PaystackVerifyResponse> {
    return this.request<PaystackVerifyResponse>(
      `/transaction/verify/${encodeURIComponent(reference)}`,
      'GET',
    );
  }

  private async request<T>(
    path: string,
    method: 'GET' | 'POST',
    body?: unknown,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const json = (await response.json()) as T & { message?: string };
      if (!response.ok) {
        this.logger.error(
          `Paystack ${method} ${path} failed: ${response.status} ${json?.message ?? ''}`,
        );
        throw new InternalServerErrorException(
          json?.message || 'Paystack request failed',
        );
      }
      return json;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        this.logger.error(`Paystack ${method} ${path} timed out`);
        throw new InternalServerErrorException('Paystack request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
