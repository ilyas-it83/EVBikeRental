import { useState } from 'react';
import { disputesApi } from '../lib/api';
import { Button } from './ui/Button';
import { useToast } from './ui/Toast';

const REASONS = [
  { value: 'overcharge', label: 'Overcharge' },
  { value: 'bike_issue', label: 'Bike Issue' },
  { value: 'wrong_station', label: 'Wrong Station' },
  { value: 'other', label: 'Other' },
];

interface DisputeFormProps {
  rideId: string;
  onClose: () => void;
  onSubmitted: () => void;
}

export function DisputeForm({ rideId, onClose, onSubmitted }: DisputeFormProps) {
  const { toast } = useToast();
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) {
      toast('Please select a reason', 'error');
      return;
    }
    if (!description.trim()) {
      toast('Please provide a description', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await disputesApi.create({ rideId, reason, description: description.trim() });
      toast('Dispute submitted successfully', 'success');
      onSubmitted();
    } catch {
      toast('Failed to submit dispute', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Dispute this Ride</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="dispute-reason" className="mb-1 block text-sm font-medium text-gray-700">
              Reason
            </label>
            <select
              id="dispute-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-green-500 focus:ring-2 focus:ring-green-500 focus:outline-none"
            >
              <option value="">Select a reason…</option>
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="dispute-description" className="mb-1 block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              id="dispute-description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your issue in detail…"
              className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-green-500 focus:ring-2 focus:ring-green-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-3">
            <Button type="submit" isLoading={isSubmitting} className="flex-1">
              Submit Dispute
            </Button>
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
