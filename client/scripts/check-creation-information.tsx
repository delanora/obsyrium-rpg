import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClassInformation } from '../src/components/creation/ClassInformation';
import { CLASS_PRESENTATIONS, CLASS_STARTING_EQUIPMENT } from '../src/components/creation/classPresentation';
import type { ClassOption } from '../src/types';

// Consulta puramente visual: todas as classes e subclasses devem revelar o catálogo.
let subclasses = 0;
for (const definition of CLASS_PRESENTATIONS) {
  const option = { key: definition.key, skillChoice: { count: 2, from: [] }, firstProficiencies: { armor: [], weapons: [], tools: [] } } as unknown as ClassOption;
  const html = renderToStaticMarkup(<ClassInformation option={option} />);
  assert.ok(html.includes(definition.name));
  assert.ok(html.includes('Equipamento inicial da classe'));
  assert.ok(CLASS_STARTING_EQUIPMENT[definition.key]?.length);
  for (const feature of definition.features) assert.ok(html.includes(feature.name.replaceAll('&', '&amp;')), `${definition.name}: ${feature.name}`);
  for (const subclass of definition.subclasses) {
    subclasses++;
    const content = renderToStaticMarkup(<ClassInformation option={option} subclass={subclass.name} />);
    assert.ok(content.includes('Detalhes da subclasse'));
    for (const feature of subclass.features) assert.ok(content.includes(feature.name.replaceAll('&', '&amp;')), `${subclass.name}: ${feature.name}`);
  }
}
assert.equal(CLASS_PRESENTATIONS.length, 12);
console.log(`Consulta de criação: 12 classes e ${subclasses} subclasses com todos os benefícios cadastrados visíveis; equipamento informativo disponível.`);
