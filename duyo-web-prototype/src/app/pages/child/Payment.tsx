import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { ArrowLeft, CreditCard, Smartphone, CheckCircle, AlertCircle } from 'lucide-react';

export const Payment: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'success' | 'failed'>('idle');

  const { plan, period } = location.state || { plan: 'standard', period: 'monthly' };

  const planDetails = {
    standard: {
      name: "Do'st",
      monthly: 29000,
      yearly: 290000,
    },
    premium: {
      name: 'Hamroh',
      monthly: 59000,
      yearly: 590000,
    },
  };

  const currentPlan = planDetails[plan as keyof typeof planDetails];
  const price = currentPlan[period as keyof typeof currentPlan];

  const paymentMethods = [
    { id: 'click', name: 'Click', icon: '💳', type: 'card' },
    { id: 'payme', name: 'Payme', icon: '💰', type: 'card' },
    { id: 'uzcard', name: 'Uzcard', icon: '💳', type: 'card' },
    { id: 'humo', name: 'Humo', icon: '💳', type: 'card' },
    { id: 'visa', name: 'Visa/Mastercard', icon: '💳', type: 'card' },
  ];

  const handlePayment = () => {
    if (!selectedMethod) return;

    setProcessing(true);
    // Simulate payment processing
    setTimeout(() => {
      const success = Math.random() > 0.2; // 80% success rate
      setPaymentStatus(success ? 'success' : 'failed');
      setProcessing(false);
    }, 2000);
  };

  if (paymentStatus === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-6">
        <Card className="p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-success rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-2">To'lov muvaffaqiyatli!</h2>
          <p className="text-muted-foreground mb-6">
            {currentPlan.name} obunasi faollashtirildi
          </p>
          <div className="p-4 bg-success/10 rounded-lg mb-6">
            <div className="text-sm text-muted-foreground mb-1">To'langan summa</div>
            <div className="text-3xl font-bold text-success">
              {price.toLocaleString()} so'm
            </div>
          </div>
          <Button className="w-full" size="lg" onClick={() => navigate('/child/home')}>
            Bosh sahifaga qaytish
          </Button>
        </Card>
      </div>
    );
  }

  if (paymentStatus === 'failed') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-6">
        <Card className="p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-destructive rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-2">To'lov amalga oshmadi</h2>
          <p className="text-muted-foreground mb-6">
            Xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring.
          </p>
          <div className="space-y-3">
            <Button
              className="w-full"
              size="lg"
              onClick={() => setPaymentStatus('idle')}
            >
              Qayta urinish
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate('/child/subscription')}
            >
              Bekor qilish
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/10">
      <div className="max-w-md mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="pt-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/child/subscription')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">To'lov</h1>
        </div>

        {/* Plan Summary */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-lg">{currentPlan.name}</h3>
              <p className="text-sm text-muted-foreground">
                {period === 'monthly' ? 'Oylik obuna' : 'Yillik obuna'}
              </p>
            </div>
            <Badge variant="default">DUYO</Badge>
          </div>
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between text-lg font-bold">
              <span>Jami:</span>
              <span className="text-primary">{price.toLocaleString()} so'm</span>
            </div>
          </div>
        </Card>

        {/* Payment Methods */}
        <Card className="p-6">
          <h3 className="font-bold mb-4">To'lov usulini tanlang</h3>
          <div className="space-y-3">
            {paymentMethods.map((method) => (
              <div
                key={method.id}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  selectedMethod === method.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => setSelectedMethod(method.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{method.icon}</div>
                  <div className="flex-1">
                    <div className="font-medium">{method.name}</div>
                  </div>
                  {selectedMethod === method.id && (
                    <CheckCircle className="w-5 h-5 text-primary" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Terms */}
        <Card className="p-4 bg-accent/10">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>✓ Avtomatik yangilanish yoqiladi</p>
            <p>✓ Istalgan vaqt bekor qilish mumkin</p>
            <p>✓ Xavfsiz to'lov</p>
            <p>✓ 7 kunlik bepul sinov</p>
          </div>
        </Card>

        {/* Pay Button */}
        <Button
          className="w-full h-14"
          size="lg"
          onClick={handlePayment}
          disabled={!selectedMethod || processing}
        >
          {processing ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Qayta ishlanmoqda...
            </>
          ) : (
            <>
              <CreditCard className="w-5 h-5 mr-2" />
              {price.toLocaleString()} so'm to'lash
            </>
          )}
        </Button>

        {/* Secure Notice */}
        <div className="text-center text-xs text-muted-foreground">
          <p>🔒 To'lovingiz xavfsiz amalga oshiriladi</p>
        </div>
      </div>
    </div>
  );
};
