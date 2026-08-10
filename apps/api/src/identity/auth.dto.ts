import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail() email!: string;
  @IsString() @Length(12, 128) password!: string;
}

export class ChangePasswordDto {
  @IsString() @Length(12, 128) currentPassword!: string;
  @IsString() @Length(12, 128) newPassword!: string;
}

export class RequestPasswordResetDto {
  @IsEmail() email!: string;
}

export class ResetPasswordDto {
  @IsString() @MaxLength(256) token!: string;
  @IsString() @Length(12, 128) newPassword!: string;
}

export class RevokeSessionDto {
  @IsString() @MaxLength(255) reason!: string;
}
