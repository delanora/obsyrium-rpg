import { z } from 'zod';
import { conditionSchema, entitySchema } from '../shared/conditions.js';
export const mechanicalMutationSchema = z.object({
  entity: entitySchema, expectedVersion: z.number().int().nonnegative(), operationId: z.string().min(1).max(128),
  expectedCombatVersion: z.number().int().nonnegative().optional(),
  action: z.enum(['apply', 'remove', 'exhaustion', 'stand', 'concentrate', 'concentrate-end', 'affliction-add', 'affliction-remove', 'affliction-visibility']),
  afflictionKind: z.enum(['poison', 'disease']).optional(),
  afflictionId: z.string().uuid().optional(),
  symptoms: z.array(conditionSchema).max(14).optional(),
  condition: conditionSchema.optional(), instanceId: z.string().min(1).optional(),
  sourceEntity: entitySchema.optional(), sourceLabel: z.string().trim().min(1).max(200).optional(),
  sourceType: z.string().trim().max(100).optional(), sourceId: z.string().max(128).optional(),
  exhaustionLevel: z.number().int().min(0).max(6).optional(),
  exhaustionDelta: z.number().int().min(-1).max(1).optional(),
  reason: z.string().trim().max(500).optional(),
  /** CONCENTRAÇÃO: nome visível do efeito e visibilidade para os jogadores. */
  label: z.string().trim().min(1).max(80).optional(),
  visibility: z.enum(['public', 'private']).optional(),
  /** Encerra SOMENTE esta concentração (id antigo não atinge a nova). */
  concentrationId: z.string().min(1).max(64).optional(),
}).superRefine((input, ctx) => {
  if (input.action === 'affliction-add' && (!input.afflictionKind || !input.label?.trim())) ctx.addIssue({ code: 'custom', message: 'Informe tipo e nome da afecção.' });
  if (input.action === 'affliction-visibility' && (!input.afflictionId || !input.visibility)) ctx.addIssue({ code: 'custom', message: 'Informe origem e visibilidade.' });
  if (input.action === 'affliction-remove' && !input.afflictionId) ctx.addIssue({ code: 'custom', message: 'Informe a origem a remover.' });
  if (input.action === 'apply' && !input.condition) ctx.addIssue({ code: 'custom', message: 'Informe a condição.' });
  if (input.action === 'remove' && !input.instanceId) ctx.addIssue({ code: 'custom', message: 'Informe a instância a remover.' });
  if (input.action === 'exhaustion' && (input.exhaustionLevel === undefined) === (input.exhaustionDelta === undefined)) ctx.addIssue({ code: 'custom', message: 'Informe nível OU incremento de Exaustão.' });
  if (input.action === 'concentrate' && !input.label) ctx.addIssue({ code: 'custom', message: 'Informe o nome/efeito da concentração.' });
});
export type MechanicalMutationInput = z.infer<typeof mechanicalMutationSchema>;
