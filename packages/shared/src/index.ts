// Shared types, constants, and enums for the EV Bike Rental platform

// ─── Enums ──────────────────────────────────────────

export enum UserRole {
  RIDER = 'rider',
  ADMIN = 'admin',
}

export enum BikeStatus {
  AVAILABLE = 'available',
  RENTED = 'rented',
  MAINTENANCE = 'maintenance',
  RETIRED = 'retired',
}

export enum RideStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum PaymentStatus {
  PENDING = 'pending',
  AUTHORIZED = 'authorized',
  CAPTURED = 'captured',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

// ─── API Response Types ─────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ─── Domain Types ───────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface Station {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string;
  capacity: number;
  availableBikes: number;
}

export interface Bike {
  id: string;
  stationId: string | null;
  status: BikeStatus;
  batteryLevel: number;
  model: string;
  lastMaintenanceAt: string;
}

export interface Ride {
  id: string;
  userId: string;
  bikeId: string;
  startStationId: string;
  endStationId: string | null;
  status: RideStatus;
  startedAt: string;
  endedAt: string | null;
  distanceKm: number | null;
  cost: number | null;
}

// ─── Auth Types ─────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  user: Omit<User, 'createdAt' | 'updatedAt'>;
  token: string;
}

// ─── Payment Types ──────────────────────────────────

export interface Payment {
  id: string;
  userId: string;
  rideId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method: string | null;
  createdAt: string;
}

export interface PaymentMethod {
  id: string;
  userId: string;
  type: 'card' | 'wallet';
  last4: string;
  brand: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
  createdAt: string;
}

// ─── Ride Detail Types ──────────────────────────────

export interface RideDetail extends Ride {
  durationMinutes: number | null;
  startStationName: string;
  endStationName: string | null;
  payment: Payment | null;
  bike: { model: string; batteryLevel: number } | null;
}

export interface PricingInfo {
  unlockFee: number;
  perMinuteRate: number;
  estimatedCost: number;
}

// ─── API Request Types ──────────────────────────────

export interface UnlockBikeRequest {
  bikeId: string;
  stationId: string;
}

export interface EndRideRequest {
  endStationId: string;
}

export interface AddPaymentMethodRequest {
  last4: string;
  brand: string;
  expiryMonth: number;
  expiryYear: number;
}

// ─── Constants ──────────────────────────────────────

export const MAX_BATTERY_LEVEL = 100;
export const MIN_RIDE_BATTERY = 15;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
