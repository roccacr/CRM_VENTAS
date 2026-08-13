import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CrmInternalTokenGuard } from '../auth/crm-internal-token.guard';
import {
  KapsoWhatsappNumberDto,
  KapsoWhatsappNumbersService,
  KapsoWhatsappNumberStatusDto,
} from './kapso-whatsapp-numbers.service';

/**
 * API interna CRM: `/api/v1/kapso/whatsapp-numbers`.
 * Todas las rutas exigen CrmInternalTokenGuard (Bearer o x-crm-api-token).
 */
@ApiTags('Kapso WhatsApp numbers')
@ApiBearerAuth()
@UseGuards(CrmInternalTokenGuard)
@Controller('kapso/whatsapp-numbers')
export class KapsoWhatsappNumbersController {
  constructor(private readonly service: KapsoWhatsappNumbersService) {}

  @Get()
  @ApiOperation({ summary: 'List Kapso WhatsApp number integrations for CRM.' })
  @ApiOkResponse({ description: 'Integrations listed.' })
  @ApiUnauthorizedResponse({ description: 'Invalid CRM internal token.' })
  async findAll(): Promise<{ data: KapsoWhatsappNumberDto[] }> {
    return { data: await this.service.findAll() };
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activate one Kapso WhatsApp number integration.' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ description: 'Integration activated.' })
  @ApiUnauthorizedResponse({ description: 'Invalid CRM internal token.' })
  activate(@Param('id') id: string): Promise<KapsoWhatsappNumberStatusDto> {
    return this.service.activate(id);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate one Kapso WhatsApp number integration.' })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ description: 'Integration deactivated.' })
  @ApiUnauthorizedResponse({ description: 'Invalid CRM internal token.' })
  deactivate(@Param('id') id: string): Promise<KapsoWhatsappNumberStatusDto> {
    return this.service.deactivate(id);
  }
}
