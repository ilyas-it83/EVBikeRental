import { useEffect, useState } from 'react';
import { subscriptionsApi } from '../lib/api';
import { Spinner } from '../components/ui/Spinner';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';

interface Plan {
  plan: string;
  name: string;
  price: number;
  interval: string;
  discountPercent: number;
}

interface Subscription {
  id: string;
  plan: string;
  status: string;
  currentPeriodEnd?: string;
}

const FALLBACK_PLANS: Plan[] = [
  { plan: 'free', name: 'Free', price: 0, interval: 'month', discountPercent: 0 },
  { plan: 'monthly', name: 'Monthly', price: 9.99, interval: 'month', discountPercent: 20 },
  { plan: 'annual', name: 'Annual', price: 89.99, interval: 'year', discountPercent: 30 },
];

export default function Subscriptions() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS);
  const [currentSub, setCurrentSub] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      subscriptionsApi.getPlans().catch(() => ({ plans: FALLBACK_PLANS })),
      subscriptionsApi.getCurrent().catch(() => ({ subscription: null })),
    ])
      .then(([plansData, subData]) => {
        if (plansData.plans?.length) setPlans(plansData.plans);
        setCurrentSub(subData.subscription || null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const currentPlan = currentSub?.plan || 'free';

  const handleSubscribe = async (plan: string) => {
    if (!window.confirm(`Subscribe to the ${plan} plan?`)) return;
    setActionLoading(plan);
    try {
      const data = await subscriptionsApi.subscribe(plan);
      setCurrentSub(data.subscription);
      toast(`Subscribed to ${plan} plan!`, 'success');
    } catch {
      toast('Failed to subscribe', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Cancel your subscription? You will revert to the Free plan.')) return;
    setActionLoading('cancel');
    try {
      await subscriptionsApi.cancel();
      setCurrentSub(null);
      toast('Subscription cancelled', 'success');
    } catch {
      toast('Failed to cancel subscription', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold text-gray-900">Subscription Plans</h1>
      <p className="mb-8 text-gray-500">Choose a plan that works for you and save on every ride.</p>

      <div className="grid gap-6 sm:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.plan;
          const isBestValue = plan.plan === 'annual';

          return (
            <div
              key={plan.plan}
              className={`relative rounded-2xl border-2 p-6 transition-shadow ${
                isCurrent
                  ? 'border-green-500 bg-green-50 shadow-lg'
                  : 'border-gray-200 bg-white hover:shadow-md'
              }`}
            >
              {isBestValue && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-green-600 px-3 py-0.5 text-xs font-bold text-white">
                  Best Value
                </span>
              )}

              {isCurrent && (
                <span className="absolute -top-3 right-4 rounded-full bg-green-500 px-3 py-0.5 text-xs font-bold text-white">
                  Current
                </span>
              )}

              <div className="mb-4 text-center">
                <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-gray-900">
                    ${plan.price.toFixed(2)}
                  </span>
                  <span className="text-sm text-gray-500">/{plan.interval === 'year' ? 'yr' : 'mo'}</span>
                </div>
              </div>

              <ul className="mb-6 space-y-2 text-sm text-gray-600">
                {plan.discountPercent > 0 ? (
                  <>
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">✓</span>
                      {plan.discountPercent}% off all rides
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">✓</span>
                      Priority bike access
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">✓</span>
                      Extended reservations
                    </li>
                  </>
                ) : (
                  <>
                    <li className="flex items-center gap-2">
                      <span className="text-gray-400">✓</span>
                      Pay-per-ride pricing
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-gray-400">✓</span>
                      Basic access
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-gray-400">✓</span>
                      Standard support
                    </li>
                  </>
                )}
              </ul>

              {isCurrent ? (
                plan.plan !== 'free' ? (
                  <Button
                    variant="secondary"
                    className="w-full"
                    size="sm"
                    isLoading={actionLoading === 'cancel'}
                    onClick={handleCancel}
                  >
                    Cancel Plan
                  </Button>
                ) : (
                  <Button variant="ghost" className="w-full" size="sm" disabled>
                    Current Plan
                  </Button>
                )
              ) : (
                plan.plan !== 'free' && (
                  <Button
                    className="w-full"
                    size="sm"
                    isLoading={actionLoading === plan.plan}
                    onClick={() => handleSubscribe(plan.plan)}
                  >
                    Subscribe
                  </Button>
                )
              )}
            </div>
          );
        })}
      </div>

      {currentSub?.currentPeriodEnd && (
        <p className="mt-6 text-center text-sm text-gray-500">
          Current period ends: {new Date(currentSub.currentPeriodEnd).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}
