import { atomWithStorage } from 'jotai/utils'

export const onboardingDismissedAtom = atomWithStorage<boolean>(
    'dvop-onboarding-done',
    false,
    undefined,
    { getOnInit: true }
)
