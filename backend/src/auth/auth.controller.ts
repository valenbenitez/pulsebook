import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { ValidateCredentialsDto } from './dto/validate-credentials.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }


  @Post('validate')
  @HttpCode(200)
  validate(@Body() dto: ValidateCredentialsDto) {
    return this.authService.validateCredentials(dto);
  }
}
