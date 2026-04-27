import { isFeatureEnabled } from '../config/featureFlags.js'

export function useFeatureFlag(flag) {
  return isFeatureEnabled(flag)
}
