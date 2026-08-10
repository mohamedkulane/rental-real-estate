import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

class FoundationValidationDto {
  @ApiProperty({ example: 'foundation-ready', minLength: 3 })
  @IsString()
  @MinLength(3)
  message!: string;
}

@ApiTags('foundation')
@Controller({ path: 'foundation', version: '1' })
export class FoundationController {
  @Post('validate')
  @ApiOperation({ summary: 'Validation and error-envelope proof endpoint' })
  validate(@Body() body: FoundationValidationDto): FoundationValidationDto {
    return body;
  }
}
