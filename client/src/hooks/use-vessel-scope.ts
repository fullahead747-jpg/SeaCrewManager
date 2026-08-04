import { useAuth } from '@/contexts/auth-context';

/**
 * Returns the vessel scope for the current user.
 *
 * - `null`  → global access (admin / unrestricted office_staff): show all vessels
 * - `string[]` → restricted: only show vessels whose IDs are in this array
 */
export function useVesselScope(): string[] | null {
  const { user } = useAuth();
  if (!user) return null;

  const assignedVesselId = (user as any).assignedVesselId as string | null | undefined;

  // Global access: admins and unscoped office staff
  if ((user.role === 'admin' || user.role === 'office_staff') && !assignedVesselId) {
    return null;
  }

  // Restricted user: has an assigned vessel
  if (assignedVesselId) {
    return [assignedVesselId];
  }

  // vessel_user with no vessel assigned → deny all
  return [];
}

/**
 * Returns true if the given vesselId is accessible to the current user.
 * For global-access users, always returns true.
 */
export function useCanAccessVessel(vesselId: string | null | undefined): boolean {
  const scope = useVesselScope();
  if (!vesselId) return false;
  if (scope === null) return true;
  return scope.includes(vesselId);
}
