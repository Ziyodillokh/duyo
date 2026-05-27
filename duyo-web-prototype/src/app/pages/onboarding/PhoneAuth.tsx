import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { DuyoAvatar } from '../../components/duyo/DuyoAvatar';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '../../components/ui/input-otp';

export const PhoneAuth: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [timer, setTimer] = useState(60);

  const handleSendCode = () => {
    if (phone.length >= 9) {
      setStep('code');
      const countdown = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            clearInterval(countdown);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  const handleVerifyCode = () => {
    if (code.length === 6) {
      navigate('/child-name');
    }
  };

  // Auto-verify when code is complete
  useEffect(() => {
    if (code.length === 6) {
      const timer = setTimeout(() => {
        navigate('/child-name');
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [code, navigate]);

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-primary/5 to-accent/10">
      <div className="w-full max-w-md flex flex-col items-center gap-8">
        <DuyoAvatar size="lg" state="idle" />

        <Card className="w-full p-6">
          {step === 'phone' ? (
            <div className="flex flex-col gap-6">
              <div className="text-center">
                <h2 className="text-xl font-bold mb-2">Telefon raqamingiz</h2>
                <p className="text-sm text-muted-foreground">
                  Xavfsizlik uchun telefon raqamingizni tasdiqlang
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Telefon raqam</label>
                <div className="flex gap-2">
                  <div className="px-4 py-2 border rounded-lg bg-muted text-muted-foreground">
                    +998
                  </div>
                  <Input
                    type="tel"
                    placeholder="901234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 9))}
                    className="flex-1"
                  />
                </div>
              </div>

              <Button
                onClick={handleSendCode}
                disabled={phone.length < 9}
                className="w-full"
              >
                SMS yuborish
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="text-center">
                <h2 className="text-xl font-bold mb-2">SMS kodni kiriting</h2>
                <p className="text-sm text-muted-foreground">
                  +998 {phone} raqamiga yuborildi
                </p>
              </div>

              <div className="flex flex-col gap-2 items-center">
                <label className="text-sm font-medium">Tasdiqlash kodi</label>
                <InputOTP
                  maxLength={6}
                  value={code}
                  onChange={(value) => setCode(value)}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button
                onClick={handleVerifyCode}
                disabled={code.length !== 6}
                className="w-full"
              >
                Tasdiqlash
              </Button>

              <div className="text-center">
                {timer > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Qayta yuborish: {timer} soniya
                  </p>
                ) : (
                  <Button variant="ghost" onClick={() => setTimer(60)}>
                    Qayta yuborish
                  </Button>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
