import { Icon, type IconName } from '../Icon';
import { CLASS_PRESENTATIONS } from './classPresentation';

const BASE: Record<string, string> = { barbarian: 'barbaro', bard: 'bardo', cleric: 'clerigo', druid: 'druida', fighter: 'guerreiro', monk: 'monge', paladin: 'paladino', ranger: 'patrulheiro', sorcerer: 'feiticeiro', warlock: 'bruxo', rogue: 'ladino' };
const SUBCLASS: Record<string, string> = {
  'rogue:thief': 'ladino_ladrao', 'rogue:assassin': 'ladino_assassino', 'rogue:arcane-trickster': 'ladino_trapaceiro_arcano',
  'warlock:archfey': 'bruxo_arquifada', 'warlock:fiend': 'bruxo_infero', 'warlock:great-old-one': 'bruxo_corruptor',
  'sorcerer:draconic': 'feiticeiro_linhagem_draconica', 'sorcerer:wild-magic': 'feiticeiro_magia_selvagem',
  'paladin:devotion': 'paladino_juramento_da_devocao', 'paladin:ancients': 'paladino_juramento_dos_ancioes', 'paladin:vengeance': 'paladino_juramento_da_vinganca',
  'ranger:hunter': 'patrulheiro_cacador', 'ranger:beast-master': 'patrulheiro_mestre_das_feras',
  'barbarian:berserker': 'barbaro_caminho_do_berserker', 'barbarian:totem-warrior': 'barbaro_caminho_do_guerreiro_totemico',
  'bard:lore': 'bardo_colegio_do_saber', 'bard:valor': 'bardo_colegio_do_valor',
  'druid:land': 'druida_circulo_da_terra', 'druid:moon': 'druida_circulo_da_lua',
  'fighter:champion': 'guerreiro_campeao', 'fighter:battle-master': 'guerreiro_mestre_de_batalha', 'fighter:eldritch-knight': 'guerreiro_cavaleiro_arcano',
  'monk:open-hand': 'monge_caminho_da_mao_aberta', 'monk:shadow': 'monge_caminho_da_sombra', 'monk:four-elements': 'monge_caminho_dos_quatro_elementos',
  'cleric:life': 'clerigo_dominio_da_vida', 'cleric:light': 'clerigo_dominio_da_luz', 'cleric:knowledge': 'clerigo_dominio_do_conhecimento',
  'cleric:nature': 'clerigo_dominio_da_natureza', 'cleric:tempest': 'clerigo_dominio_da_tempestade', 'cleric:trickery': 'clerigo_dominio_da_trapaca', 'cleric:war': 'clerigo_dominio_da_guerra',
};
const FALLBACK: Record<string, IconName> = { barbarian: 'flame', bard: 'music', cleric: 'sun', druid: 'earth', fighter: 'sword', monk: 'wind', paladin: 'shield', ranger: 'ammo', rogue: 'eye', sorcerer: 'bolt', warlock: 'moon', wizard: 'book' };
export function classEmblemAsset(classKey: string, subclass?: string): string | undefined {
  const id = subclass ? CLASS_PRESENTATIONS.find(entry => entry.key === classKey)?.subclasses.find(entry => entry.name === subclass)?.id : undefined;
  const asset = subclass ? SUBCLASS[`${classKey}:${id}`] : BASE[classKey];
  return asset ? `/class-icons/${asset}.webp` : undefined;
}
/** As artes ocupam a mesma área; nomes e regras continuam vindo do catálogo. */
export function ClassEmblem({ classKey, subclass }: { classKey: string; subclass?: string }) {
  const asset = classEmblemAsset(classKey, subclass);
  return asset ? <img className="class-emblem-art" data-emblem={asset.split('/').pop()?.replace('.webp', '')} src={asset} alt="" aria-hidden="true" draggable={false} decoding="async" /> : <Icon name={FALLBACK[classKey] ?? 'star'} size={64} />;
}
