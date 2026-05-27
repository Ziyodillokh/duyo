import { apiClient } from '@/api/client';

export interface SendOtpResponse {
  status: 'sent';
  phone: string;
}

// Backend snake_case wire format — converted into AuthTokens before persisting.
export interface TokenResponseDto {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export async function sendOtp(phone: string): Promise<SendOtpResponse> {
  const { data } = await apiClient.post<SendOtpResponse>('/auth/otp/send', {
    phone,
  });
  return data;
}

export async function verifyOtp(
  phone: string,
  code: string,
): Promise<TokenResponseDto> {
  const { data } = await apiClient.post<TokenResponseDto>('/auth/otp/verify', {
    phone,
    code,
  });
  return data;
}
