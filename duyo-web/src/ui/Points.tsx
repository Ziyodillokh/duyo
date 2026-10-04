/**
 * The points under a section's words (content.ts PointGroup): pills, a
 * two-column list, numbered steps or a row of layers. Each item carries one
 * of the copy's drawings in a blue tile, as on the concept deck.
 *
 * At phone width a pinned caption has little height to give, so the grid,
 * the steps and the layers drop their second line there (page.css): the
 * name of each point stays, and the scene above shows what it means.
 */

import type { CSSProperties } from 'react';
import type { PointGroup } from '../content';
import { Icon } from './icons';

function Group({ group, slot }: { group: PointGroup; slot: number }) {
  const { style, label, items } = group;
  const List = style === 'steps' ? 'ol' : 'ul';
  return (
    <div className={`rv points-group${group.optional ? ' points-group--optional' : ''}`} style={{ '--rv': slot } as CSSProperties}>
      {label && <p className="points-label">{label}</p>}
      {/* role: Safari drops a list's semantics with its bullets (list-style: none). */}
      <List className={`points points--${style}`} role="list">
        {items.map((item, i) => (
          <li key={item.title} className={`point${item.lead ? ' point--lead' : ''}`}>
            <span className="tile" aria-hidden="true">
              <Icon name={item.icon} />
            </span>
            {style === 'steps' && <span className="point-no" aria-hidden="true">{i + 1}</span>}
            {style === 'chips' ? (
              <span className="point-title">{item.title}</span>
            ) : (
              <span className="point-words">
                <span className="point-title">{item.title}</span>
                {item.text && <span className="point-text">{item.text}</span>}
              </span>
            )}
          </li>
        ))}
      </List>
    </div>
  );
}

export function Points({ groups, from }: { groups: readonly PointGroup[]; from: number }) {
  return (
    <>
      {groups.map((g, i) => (
        <Group key={g.label ?? g.style + i} group={g} slot={from + i} />
      ))}
    </>
  );
}
