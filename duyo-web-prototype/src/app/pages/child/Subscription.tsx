import React, { useState } from 'react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { BottomNav } from '../../components/child/BottomNav';
import { Check, Crown, Zap, Users, Mic, Star, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router';

const plans = [
  {
    id: 'free',
    name: 'Tanish',
    price: { monthly: 0, yearly: 0 },
    features: [
      '1 ta til',
      'Faqat skript javoblar',
      'Kuniga 20 daqiqa',
      'Cheklangan kontent',
    ],
    limitations: true,
  },
  {
    id: 'standard',
    name: 'Do\'st',
    price: { monthly: 29000, yearly: 290000 },
    badge: 'Mashhur',
    features: [
      '3 ta til',
      'AI suhbat - kuniga 30 ta',
      'To\'liq gamifikatsiya',
      'Barcha oddiy kontent',
      'Ota-ona hisoboti',
    ],
    popular: true,
  },
  {
    id: 'premium',
    name: 'Hamroh',
    price: { monthly: 59000, yearly: 590000 },
    badge: 'Premium',
    features: [
      'AI suhbat - kuniga 200 ta',
      'Ovozli suhbat',
      '2 ta bola uchun',
      'Premium kontent',
      'Ustuvor yordam',
      'DTM/IELTS tayyorgarlik',
    ],
    premium: true,
  },
];

export const Subscription: React.FC = () => {
  const navigate = useNavigate();
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const handleSubscribe = (planId: string) => {
    if (planId === 'free') {
      alert('Siz allaqachon bepul rejada ishlatmoqdasiz');
      return;
    }
    setSelectedPlan(planId);
    navigate('/child/payment', { state: { plan: planId, period: billingPeriod } });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/10 pb-20">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="pt-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold mb-2">Premium'ga o'ting</h1>
            <p className="text-muted-foreground">
              DUYO bilan ko'proq o'rganing va o'sing
            </p>
          </div>

          {/* Billing Period Toggle */}
          <Card className="p-2 flex gap-2">
            <Button
              variant={billingPeriod === 'monthly' ? 'default' : 'ghost'}
              className="flex-1"
              onClick={() => setBillingPeriod('monthly')}
            >
              Oylik
            </Button>
            <Button
              variant={billingPeriod === 'yearly' ? 'default' : 'ghost'}
              className="flex-1"
              onClick={() => setBillingPeriod('yearly')}
            >
              Yillik
              <Badge className="ml-2 bg-success">-17%</Badge>
            </Button>
          </Card>
        </div>

        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`p-6 relative ${
                plan.popular
                  ? 'border-2 border-primary shadow-xl'
                  : plan.premium
                  ? 'border-2 border-accent shadow-xl'
                  : ''
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge
                    className={`${
                      plan.premium
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-primary text-primary-foreground'
                    }`}
                  >
                    {plan.badge}
                  </Badge>
                </div>
              )}

              <div className="text-center mb-4">
                {plan.premium && <Crown className="w-10 h-10 text-accent mx-auto mb-2" />}
                {plan.popular && <Star className="w-10 h-10 text-primary mx-auto mb-2" />}
                {plan.limitations && <Zap className="w-10 h-10 text-muted-foreground mx-auto mb-2" />}

                <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                <div className="text-3xl font-bold">
                  {plan.price[billingPeriod] === 0 ? (
                    'Bepul'
                  ) : (
                    <>
                      {plan.price[billingPeriod].toLocaleString()}
                      <span className="text-sm text-muted-foreground"> so'm</span>
                    </>
                  )}
                </div>
                {plan.price[billingPeriod] > 0 && (
                  <div className="text-sm text-muted-foreground">
                    / {billingPeriod === 'monthly' ? 'oy' : 'yil'}
                  </div>
                )}
              </div>

              <div className="space-y-3 mb-6">
                {plan.features.map((feature, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              <Button
                className="w-full"
                variant={plan.popular || plan.premium ? 'default' : 'outline'}
                onClick={() => handleSubscribe(plan.id)}
              >
                {plan.id === 'free' ? 'Joriy reja' : 'Tanlash'}
              </Button>
            </Card>
          ))}
        </div>

        {/* Features Info */}
        <Card className="p-6 bg-accent/10">
          <h3 className="font-bold mb-4">Barcha rejalarda:</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-success" />
              <span className="text-sm">7 kun bepul sinov</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-success" />
              <span className="text-sm">Istalgan vaqt bekor qilish</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-success" />
              <span className="text-sm">Xavfsiz to'lov</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-success" />
              <span className="text-sm">24/7 yordam</span>
            </div>
          </div>
        </Card>

        {/* Payment methods */}
        <Card className="p-6">
          <h3 className="font-bold mb-4 text-center">To'lov usullari</h3>
          <div className="flex flex-wrap justify-center gap-4">
            <Badge variant="outline" className="px-4 py-2">Click</Badge>
            <Badge variant="outline" className="px-4 py-2">Payme</Badge>
            <Badge variant="outline" className="px-4 py-2">Uzcard</Badge>
            <Badge variant="outline" className="px-4 py-2">Humo</Badge>
            <Badge variant="outline" className="px-4 py-2">Visa/Mastercard</Badge>
          </div>
        </Card>
      </div>

      <BottomNav />
    </div>
  );
};
