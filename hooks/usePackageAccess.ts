// Simplified stub — all users have full access in this deployment
export function usePackageAccess() {
  return {
    userType: 'Pro' as const,
    userStatus: 'active' as const,
    loading: false,
    hasFullAccess: (_feature: string) => true,
    getLimit: (_feature: string) => null,
    getPreviewLimit: (_feature: string) => null,
    needsUpgrade: (_feature: string) => false,
    upgradeTarget: (_feature: string) => 'Pro' as const,
    isTrialExpired: false,
    trialEndsAt: null,
    isPending: false,
  };
}
