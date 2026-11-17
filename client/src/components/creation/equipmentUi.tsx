import { useEffect, useState } from 'react';
import { api } from '../../api';
import { Icon } from '../Icon';
import type { Item } from '../../types';
import {
  EQUIPMENT_PRODUCTS,
  equipmentArtwork,
  type EquipmentGrant,
  type EquipmentProduct,
} from '../../../../src/modules/shared/creation-equipment';
import './starting-equipment.css';
let artwork: Promise<Item[]> | null = null;
export function useEquipmentProducts() {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    let live = true;
    artwork ??= api<{ items: Item[] }>('/api/items')
      .then((result) => result.items)
      .catch(() => {
        artwork = null;
        return [];
      });
    void artwork.then((values) => {
      if (live) setItems(values);
    });
    return () => {
      live = false;
    };
  }, []);
  return EQUIPMENT_PRODUCTS.map((product) => ({
    ...product,
    imageUrl: equipmentArtwork(product, items)?.imageUrl ?? '',
  }));
}
export const equipmentPrice = (cp: number) =>
  `${Math.floor(cp / 100)} PO${cp % 100 >= 10 ? ` · ${Math.floor((cp % 100) / 10)} PP` : ''}${cp % 10 ? ` · ${cp % 10} PC` : ''}`;
export function EquipmentIcon({ item }: { item: EquipmentProduct }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [item.imageUrl]);
  return (
    <span className="equipment-icon">
      {item.imageUrl && !broken ? (
        <img src={item.imageUrl} alt="" loading="lazy" onError={() => setBroken(true)} />
      ) : (
        <Icon
          name={
            item.category === 'Arma' ? 'sword' : item.category === 'Armadura' ? 'shield' : 'bag'
          }
          size={26}
        />
      )}
    </span>
  );
}
export function EquipmentItem({
  item,
  quantity = 1,
}: {
  item: EquipmentProduct;
  quantity?: number;
}) {
  return (
    <details className="equipment-item">
      <summary>
        <EquipmentIcon item={item} />
        <span>
          <strong>{item.name}</strong>
          <small>
            {quantity} un. ·{' '}
            {(item.weight * quantity).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg
          </small>
        </span>
      </summary>
      <p>{item.description}</p>
      {item.contents ? (
        <ul>
          {item.contents.map((row, index) => (
            <li key={index}>
              {row.quantity} × {EQUIPMENT_PRODUCTS.find((product) => product.id === row.id)?.name}
            </li>
          ))}
        </ul>
      ) : null}
    </details>
  );
}
export function EquipmentGrantList({
  rows,
  products,
}: {
  rows: EquipmentGrant[];
  products: EquipmentProduct[];
}) {
  return (
    <div className="equipment-grants">
      {rows.map((row, index) => {
        const item = products.find((item) => item.id === row.id);
        return item ? (
          <EquipmentItem key={row.id + index} item={item} quantity={row.quantity} />
        ) : null;
      })}
    </div>
  );
}
export function EquipmentReview({
  rows,
  remainingCp,
}: {
  rows: EquipmentGrant[];
  remainingCp: number;
}) {
  const products = useEquipmentProducts();
  return (
    <section aria-label="Equipamentos ao finalizar">
      <h3 className="wizard-information-heading">Equipamentos iniciais</h3>
      <EquipmentGrantList rows={rows} products={products} />
      <p>
        Moedas a receber: <strong>{equipmentPrice(remainingCp)}</strong>.
      </p>
    </section>
  );
}
