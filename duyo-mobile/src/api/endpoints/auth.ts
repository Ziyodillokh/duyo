import { apiClient } from '@/api/client';

export interface SendOtpResponse {
  /** 'demo' while no SMS provider is connected — then `demo_code` is filled. */
  status: 'sent' | 'demo';
  phone: string;
  /** The code to type, published by the server because no SMS will arrive. */
  demo_code?: string;
}

// Backend snake_case wire format — converted into AuthTokens before persisting.
export interface TokenResponseDto {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  /** Set only when this verify claimed a parent's pending FamilyInvite —
   * the name the parent already gave this child, so onboarding can skip
   * re-asking it. */
  linked_child_name?: string | null;
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
