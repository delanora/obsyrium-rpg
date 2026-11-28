import { api } from './api';
import { newId } from './utils';
import type { Character } from './types';
export interface LayOnHandsTarget { target: { kind: 'character' | 'combatant'; id: string }; name: string; version: number; reason: string | null }
export interface LayOnHandsOptions { characterVersion: number; remaining: number; max: number; canUse: boolean; targets: LayOnHandsTarget[] }
export const fetchLayOnHandsOptions = () => api<LayOnHandsOptions>('/api/characters/me/features/lay-on-hands/options');
export const healWithLayOnHands = (options: LayOnHandsOptions, target: LayOnHandsTarget, amount: number) =>
  api<{ character: Character; healed: number; remaining: number; noEffect: boolean }>('/api/characters/me/features/lay-on-hands/heal', {
    method: 'POST', body: { target: target.target, amount, expectedVersion: options.characterVersion, expectedTargetVersion: target.version, operationId: newId() },
  });
