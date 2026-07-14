import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { SuperAdminGuard } from '../../common/guards';
import { IssuedFinesService } from './issued-fines.service';
import { QueryIssuedFinesDto } from './dto/fines.dto';
import {
  IssuedFineListResponseDto,
  IssuedFineResponseDto,
  IssuedFinesSummaryResponseDto,
} from './dto/fines-response.dto';

@ApiTags('issued-fines')
@ApiBearerAuth('access-token')
@Controller('api/issued-fines')
@UseGuards(AuthGuard('jwt'), SuperAdminGuard)
export class IssuedFinesController {
  constructor(private readonly issuedFinesService: IssuedFinesService) {}

  @Get('summary')
  @ApiOkResponse({ type: IssuedFinesSummaryResponseDto })
  async summary() {
    return this.ok(
      'Issued fines summary fetched successfully',
      await this.issuedFinesService.issuedFinesSummary(),
    );
  }

  @Get('export')
  @ApiProduces('text/csv')
  @ApiOkResponse({
    description: 'CSV export of issued fines (respects list query filters)',
    schema: { type: 'string', example: 'Issued Fine ID,Penalty Name,...' },
  })
  async exportCsv(@Query() query: QueryIssuedFinesDto, @Res() res: Response) {
    const csv = await this.issuedFinesService.exportCsv(query);
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename=issued-fines-export-${Date.now()}.csv`,
    });
    res.send(csv);
  }

  @Get()
  @ApiOkResponse({ type: IssuedFineListResponseDto })
  async findAll(@Query() query: QueryIssuedFinesDto) {
    return this.ok(
      'Issued fines fetched successfully',
      await this.issuedFinesService.findIssuedFines(query),
    );
  }

  @Get(':id')
  @ApiOkResponse({ type: IssuedFineResponseDto })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ok(
      'Issued fine fetched successfully',
      await this.issuedFinesService.findIssuedFine(id),
    );
  }

  private ok(message: string, data: unknown) {
    return { success: true, message, data };
  }
}
