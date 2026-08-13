import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  RawBodyRequest,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';

import { KapsoPlatformWebhookService } from './kapso-platform-webhook.service';
import { KapsoWebhookSignatureService } from './kapso-webhook-signature.service';

/** `POST /api/v1/webhooks/kapso/platform` — recibe eventos Kapso. */
@ApiTags('Kapso webhooks')
@Controller('webhooks/kapso')
export class KapsoPlatformWebhookController {
  constructor(
    private readonly configService: ConfigService,
    private readonly platformWebhookService: KapsoPlatformWebhookService,
    private readonly signatureService: KapsoWebhookSignatureService,
  ) {}

  @Post('platform')
  @ApiOperation({ summary: 'Receive Kapso Platform project webhooks.' })
  @ApiHeader({ name: 'X-Webhook-Signature', required: true })
  @ApiHeader({ name: 'X-Webhook-Event', required: true })
  @ApiHeader({ name: 'X-Idempotency-Key', required: false })
  @ApiOkResponse({ description: 'Webhook accepted.' })
  @ApiUnauthorizedResponse({ description: 'Invalid webhook signature.' })
  @HttpCode(HttpStatus.OK)
  async receivePlatformWebhook(
    @Body() payload: unknown,
    @Headers('x-webhook-event') event: string | undefined,
    @Headers('x-webhook-signature') signature: string | undefined,
    @Headers('x-idempotency-key') idempotencyKey: string | undefined,
    @Req() request: RawBodyRequest<Request>,
  ): Promise<{ ok: true; processed: boolean; action: 'created' | 'deleted' | 'ignored' }> {
    if (!event) {
      throw new BadRequestException('Missing X-Webhook-Event header');
    }

    const secret = this.configService.get<string>('KAPSO_PLATFORM_WEBHOOK_SECRET');
    // rawBody = bytes exactos; fallback a JSON.stringify si no hay buffer
    const rawBody = request.rawBody?.toString('utf8') ?? JSON.stringify(payload);

    if (!this.signatureService.verify(rawBody, signature, secret)) {
      throw new UnauthorizedException('Invalid Kapso webhook signature');
    }

    const result = await this.platformWebhookService.process({
      event,
      idempotencyKey,
      payload,
    });

    return { ok: true, ...result };
  }
}
