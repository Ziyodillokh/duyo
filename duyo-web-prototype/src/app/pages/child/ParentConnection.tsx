import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { DuyoAvatar } from '../../components/duyo/DuyoAvatar';
import { QrCode, Send, Users, Shield, CheckCircle } from 'lucide-react';

export const ParentConnection: React.FC = () => {
  const navigate = useNavigate();
  const [method, setMethod] = useState<'qr' | 'sms'>('qr');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [sent, setSent] = useState(false);

  const handleSendSMS = () => {
    if (phoneNumber.length >= 9) {
      setSent(true);
      setTimeout(() => {
        navigate('/child/home');
      }, 2000);
    }
  };

  const handleSkip = () => {
    navigate('/child/home');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/10 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Avatar */}
        <div className="flex justify-center">
          <DuyoAvatar size="lg" state="happy" />
        </div>

        {/* Main Card */}
        <Card className="p-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold mb-2">Ota-onangizni ulang</h2>
            <p className="text-muted-foreground">
              Xavfsizlik uchun ota-onangizni ulash tavsiya etiladi
            </p>
          </div>

          {/* Method Selection */}
          <div className="flex gap-2 mb-6">
            <Button
              variant={method === 'qr' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setMethod('qr')}
            >
              <QrCode className="w-4 h-4 mr-2" />
              QR kod
            </Button>
            <Button
              variant={method === 'sms' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setMethod('sms')}
            >
              <Send className="w-4 h-4 mr-2" />
              SMS
            </Button>
          </div>

          {/* QR Code Method */}
          {method === 'qr' && (
            <div className="space-y-6">
              <div className="p-8 bg-white border-2 border-border rounded-lg flex items-center justify-center">
                <div className="w-48 h-48 bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg flex items-center justify-center">
                  <QrCode className="w-32 h-32 text-primary" />
                </div>
              </div>
              <div className="text-center text-sm text-muted-foreground">
                <p>Ota-onangiz telefonidan DUYO ilovasini oching va bu QR kodni skanerlang</p>
              </div>
            </div>
          )}

          {/* SMS Method */}
          {method === 'sms' && (
            <div className="space-y-6">
              {!sent ? (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Ota-ona telefon raqami
                    </label>
                    <div className="flex gap-2">
                      <div className="px-4 py-2 border rounded-lg bg-muted text-muted-foreground">
                        +998
                      </div>
                      <Input
                        type="tel"
                        placeholder="901234567"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 9))}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleSendSMS}
                    disabled={phoneNumber.length < 9}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    SMS yuborish
                  </Button>
                </>
              ) : (
                <div className="text-center py-6">
                  <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
                  <h3 className="font-bold text-lg mb-2">Havolа yuborildi!</h3>
                  <p className="text-sm text-muted-foreground">
                    +998 {phoneNumber} raqamiga ulanish havolasi yuborildi
                  </p>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Benefits */}
        <Card className="p-6 bg-blue-50 border-blue-200">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Nima uchun kerak?
          </h3>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <span className="text-primary">✓</span>
              <span>Ota-onangiz faolligingizni kuzatib boradi</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary">✓</span>
              <span>Xavfsizlik holati haqida xabardor bo'ladi</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-primary">✓</span>
              <span>Suhbatlaringiz maxfiy qoladi</span>
            </div>
          </div>
        </Card>

        {/* Skip Option */}
        <div className="text-center">
          <Button variant="ghost" onClick={handleSkip}>
            Keyinroq
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Sozlamalarda ham ulashingiz mumkin
          </p>
        </div>
      </div>
    </div>
  );
};
