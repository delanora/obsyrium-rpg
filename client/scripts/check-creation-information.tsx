import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent("export async function load(url,context,next){return url.endsWith('.css')?{format:'module',source:'export default {}',shortCircuit:true}:next(url,context)}"), import.meta.url);
const { ClassInformation } = await import('../src/components/creation/ClassInformation');
import { CLASS_PRESENTATIONS } from '../src/components/creation/classPresentation';
import { equipmentConfiguration } from '../../src/modules/shared/creation-equipment';
import type { ClassOption } from '../src/types';

// Consulta puramente visual: todas as classes e subclasses devem revelar o catálogo.
let subclasses = 0;
for (const definition of CLASS_PRESENTATIONS) {
  const option = { key: definition.key, skillChoice: { count: 2, from: [] }, firstProficiencies: { armor: [], weapons: [], tools: [] } } as unknown as ClassOption;
  const html = renderToStaticMarkup(<ClassInformation option={option} />);
  assert.ok(html.includes(definition.name));
  assert.ok(!html.includes('Equipamento inicial da classe'));
  assert.ok(!html.includes('Progressão nos próximos níveis'));
  assert.ok(!html.includes('undefined'));
  assert.ok(equipmentConfiguration(definition.key, 'criminal').groups.length);
  for (const feature of definition.features.filter(feature => feature.level <= 1)) assert.ok(html.includes(feature.name.replaceAll('&', '&amp;')), `${definition.name}: ${feature.name}`);
  for (const subclass of definition.subclasses) {
    subclasses++;
    const content = renderToStaticMarkup(<ClassInformation option={option} subclass={subclass.name} />);
    assert.ok(content.includes('Detalhes da subclasse'));
    for (const feature of subclass.features.filter(feature => feature.level <= 1)) assert.ok(content.includes(feature.name.replaceAll('&', '&amp;')), `${subclass.name}: ${feature.name}`);
  }
}
assert.equal(CLASS_PRESENTATIONS.length, 12);
console.log(`Consulta de criação: 12 classes e ${subclasses} subclasses com benefícios iniciais visíveis; equipamentos reservados à etapa própria.`);
