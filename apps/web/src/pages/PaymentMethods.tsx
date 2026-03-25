import { useEffect, useState, type FormEvent } from 'react';
import { paymentMethodsApi, type PaymentMethodResponse } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';

const BRANDS = ['Visa', 'Mastercard', 'Amex'] as const;

export default function PaymentMethods() {
  const { toast } = useToast();

  const [methods, setMethods] = useState<PaymentMethodResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  // Add form state
  const [last4, setLast4] = useState('');
  const [brand, setBrand] = useState<string>(BRANDS[0]);
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchMethods = () => {
    paymentMethodsApi
      .list()
      .then((data) => setMethods(data.paymentMethods))
      .catch(() => toast('Failed to load payment methods', 'error'))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchMethods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (last4.length !== 4 || !/^\d{4}$/.test(last4)) {
      toast('Enter exactly 4 digits', 'error');
      return;
    }
    const month = parseInt(expiryMonth, 10);
    const year = parseInt(expiryYear, 10);
    if (!month || month < 1 || month > 12) {
      toast('Enter a valid month (1-12)', 'error');
      return;
    }
    if (!year || year < new Date().getFullYear()) {
      toast('Enter a valid future year', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const { paymentMethod } = await paymentMethodsApi.add({ last4, brand, expiryMonth: month, expiryYear: year });
      setMethods((prev) => [...prev, paymentMethod]);
      toast('Payment method added', 'success');
      setShowAdd(false);
      setLast4('');
      setExpiryMonth('');
      setExpiryYear('');
    } catch {
      toast('Failed to add payment method', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async (id: string) => {
    if (!window.confirm('Remove this payment method?')) return;
    setActionLoadingId(id);
    try {
      await paymentMethodsApi.remove(id);
      setMethods((prev) => prev.filter((m) => m.id !== id));
      toast('Payment method removed', 'success');
    } catch {
      toast('Failed to remove payment method', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSetDefault = async (id: string) => {
    setActionLoadingId(id);
    try {
      await paymentMethodsApi.setDefault(id);
      setMethods((prev) => prev.map((m) => ({ ...m, isDefault: m.id === id })));
      toast('Default payment method updated', 'success');
    } catch {
      toast('Failed to update default', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const brandIcon = (b: string) => {
    if (b.toLowerCase().includes('visa')) return '💳';
    if (b.toLowerCase().includes('master')) return '💳';
    if (b.toLowerCase().includes('amex')) return '💳';
    return '💳';
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Payment Methods</h1>

      {/* Card list */}
      {methods.length === 0 ? (
        <div className="mb-6 rounded-xl bg-gray-50 py-12 text-center">
          <p className="text-gray-500">No payment methods yet</p>
          <p className="mt-1 text-sm text-gray-400">Add a card to start riding</p>
        </div>
      ) : (
        <div className="mb-6 space-y-3">
          {methods.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{brandIcon(m.brand)}</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {m.brand} •••• {m.last4}
                    {m.isDefault && (
                      <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        Default
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    Expires {String(m.expiryMonth).padStart(2, '0')}/{m.expiryYear}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {!m.isDefault && (
                  <button
                    onClick={() => handleSetDefault(m.id)}
                    disabled={actionLoadingId === m.id}
                    className="rounded-md px-2 py-1 text-xs text-green-600 hover:bg-green-50 disabled:opacity-50"
                  >
                    Set Default
                  </button>
                )}
                <button
                  onClick={() => handleRemove(m.id)}
                  disabled={actionLoadingId === m.id}
                  className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showAdd ? (
        <form onSubmit={handleAdd} className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Add Payment Method</h2>

          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium text-gray-700">Last 4 Digits</label>
            <input
              type="text"
              maxLength={4}
              value={last4}
              onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))}
              placeholder="1234"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
            />
          </div>

          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium text-gray-700">Brand</label>
            <select
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
            >
              {BRANDS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Month</label>
              <input
                type="number"
                min={1}
                max={12}
                value={expiryMonth}
                onChange={(e) => setExpiryMonth(e.target.value)}
                placeholder="MM"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Year</label>
              <input
                type="number"
                min={new Date().getFullYear()}
                value={expiryYear}
                onChange={(e) => setExpiryYear(e.target.value)}
                placeholder="YYYY"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="submit" isLoading={isSubmitting} className="flex-1">
              Add Card
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowAdd(false)} className="flex-1">
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button onClick={() => setShowAdd(true)} className="w-full">
          + Add Payment Method
        </Button>
      )}
    </div>
  );
}
