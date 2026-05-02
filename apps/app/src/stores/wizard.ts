import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

export const wizardOpenAtom = atom(false)
export const wizardStepAtom = atom(0)
// Persisted — once dismissed/completed, never auto-opens again
export const wizardDoneAtom = atomWithStorage<boolean>('dvop-wizard-done', false, undefined, {
    getOnInit: true
})
