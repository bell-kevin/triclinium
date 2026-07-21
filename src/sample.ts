// SPDX-License-Identifier: AGPL-3.0-only
import type { Guest, Pair, Plan } from './types';
import { seatKey } from './types';

let n = 0;
const g = (name: string, group: string, lockedTable: string | null = null): Guest => ({
  id: `sg${++n}`,
  name,
  group,
  lockedTable,
});

export function weddingSample(): Plan {
  n = 0;
  const head = [
    g('Ava Bell', 'Wedding party', 'th'),
    g('Marco Ramirez', 'Wedding party', 'th'),
    g('Margaret Bell', 'Bell family', 'th'),
    g('Harold Bell', 'Bell family', 'th'),
    g('Lucia Ramirez', 'Ramirez family', 'th'),
    g('Esteban Ramirez', 'Ramirez family', 'th'),
    g('Nadia Osei', 'Wedding party', 'th'),
    g('Tom Whitfield', 'Wedding party', 'th'),
  ];
  const bells = [
    g('Ray Bell', 'Bell family'),
    g('Gus Bell', 'Bell family'),
    g('Doreen Bell', 'Bell family'),
    g('Frank Bell', 'Bell family'),
    g('June Bell-Carter', 'Bell family'),
    g('Omar Carter', 'Bell family'),
    g('Hazel Bell', 'Bell family'),
    g('Pete Bell', 'Bell family'),
  ];
  const ramirez = [
    g('Sofia Ramirez', 'Ramirez family'),
    g('Diego Ramirez', 'Ramirez family'),
    g('Carmen Ramirez', 'Ramirez family'),
    g('Hector Ramirez', 'Ramirez family'),
    g('Alma Ruiz', 'Ramirez family'),
    g('Tomas Ruiz', 'Ramirez family'),
    g('Isabel Vega', 'Ramirez family'),
    g('Rafael Vega', 'Ramirez family'),
  ];
  const college = [
    g('Priya Shah', 'College friends'),
    g('Dan Kowalski', 'College friends'),
    g('Mei Lin', 'College friends'),
    g('Jordan Pratt', 'College friends'),
    g('Sam Okafor', 'College friends'),
    g('Bea Fontaine', 'College friends'),
    g('Leo Marsh', 'College friends'),
    g('Tessa Quinn', 'College friends'),
  ];
  const work = [
    g('Denise Cho', 'Coworkers'),
    g('Victor Cho', 'Coworkers'),
    g('Grace Ahn', 'Coworkers'),
    g('Will Tanner', 'Coworkers'),
    g('Rosa Delgado', 'Coworkers'),
    g('Kurt Weiss', 'Coworkers'),
    g('Amara Diallo', 'Coworkers'),
    g('Felix Nord', 'Coworkers'),
  ];
  const neighbors = [
    g('Bonnie Larsen', 'Neighbors'),
    g('Chuck Larsen', 'Neighbors'),
    g('Yuki Tanaka', 'Neighbors'),
    g('Ken Tanaka', 'Neighbors'),
    g('Pearl Whitaker', 'Neighbors'),
    g('Stan Whitaker', 'Neighbors'),
  ];
  const kids = [g('Mia Ramirez', 'Kids'), g('Theo Bell', 'Kids'), g('Zoe Carter', 'Kids'), g('Max Ruiz', 'Kids')];

  const guests = [...head, ...bells, ...ramirez, ...college, ...work, ...neighbors, ...kids];
  const id = (name: string): string => guests.find((x) => x.name === name)!.id;

  const pairs: Pair[] = [
    { id: 'sp1', a: id('Ray Bell'), b: id('Gus Bell'), kind: 'apart' },
    { id: 'sp2', a: id('Denise Cho'), b: id('Victor Cho'), kind: 'apart' },
    { id: 'sp3', a: id('Max Ruiz'), b: id('Theo Bell'), kind: 'apart' },
    { id: 'sp4', a: id('June Bell-Carter'), b: id('Omar Carter'), kind: 'together' },
    { id: 'sp5', a: id('Alma Ruiz'), b: id('Tomas Ruiz'), kind: 'together' },
    { id: 'sp6', a: id('Bonnie Larsen'), b: id('Chuck Larsen'), kind: 'together' },
    { id: 'sp7', a: id('Yuki Tanaka'), b: id('Ken Tanaka'), kind: 'together' },
    { id: 'sp8', a: id('Pearl Whitaker'), b: id('Stan Whitaker'), kind: 'together' },
    { id: 'sp9', a: id('Priya Shah'), b: id('Dan Kowalski'), kind: 'together' },
  ];

  const seating: Record<string, string> = {};
  head.forEach((h, i) => {
    seating[seatKey('th', i)] = h.id;
  });

  return {
    v: 1,
    eventName: 'Ava & Marco — Reception',
    tables: [
      { id: 'th', name: 'Head table', kind: 'head', seats: 8, x: 500, y: 130, rot: 0 },
      { id: 't1', name: 'Table 1', kind: 'round', seats: 8, x: 235, y: 315, rot: 0 },
      { id: 't2', name: 'Table 2', kind: 'round', seats: 8, x: 765, y: 315, rot: 0 },
      { id: 't3', name: 'Table 3', kind: 'round', seats: 8, x: 180, y: 545, rot: 0 },
      { id: 't4', name: 'Table 4', kind: 'round', seats: 8, x: 820, y: 545, rot: 0 },
      { id: 't5', name: 'Table 5', kind: 'round', seats: 8, x: 385, y: 670, rot: 0 },
      { id: 't6', name: 'Table 6', kind: 'round', seats: 8, x: 615, y: 670, rot: 0 },
      { id: 'tk', name: 'Kids', kind: 'rect', seats: 6, x: 500, y: 505, rot: 0 },
    ],
    fixtures: [
      { id: 'f1', label: 'Stage', x: 500, y: 36, w: 260, h: 52 },
      { id: 'f2', label: 'Dance floor', x: 500, y: 330, w: 220, h: 140 },
      { id: 'f3', label: 'Gifts', x: 130, y: 120, w: 110, h: 54 },
      { id: 'f4', label: 'Cake', x: 868, y: 120, w: 84, h: 64 },
    ],
    guests,
    pairs,
    seating,
  };
}

export function classroomSample(): Plan {
  n = 0;
  const names = [
    'Ava R.', 'Ben T.', 'Cal W.', 'Dina M.', 'Eli S.', 'Fern K.', 'Gus O.', 'Hana L.',
    'Iris B.', 'Jax D.', 'Kira N.', 'Liam F.', 'Mona C.', 'Nico V.', 'Opal H.', 'Pax J.',
    'Quinn A.', 'Rory G.', 'Sage E.', 'Tia Y.', 'Uma Z.', 'Vic Q.',
  ];
  const groups = ['Red group', 'Blue group', 'Green group'];
  const guests = names.map((nm, i) => g(nm, groups[i % 3]));
  guests.find((x) => x.name === 'Iris B.')!.lockedTable = 'r1'; // needs the front row

  const id = (name: string): string => guests.find((x) => x.name === name)!.id;
  const pairs: Pair[] = [
    { id: 'cp1', a: id('Jax D.'), b: id('Gus O.'), kind: 'apart' },
    { id: 'cp2', a: id('Ben T.'), b: id('Liam F.'), kind: 'apart' },
    { id: 'cp3', a: id('Kira N.'), b: id('Tia Y.'), kind: 'apart' },
  ];

  return {
    v: 1,
    eventName: 'Period 3 · Biology',
    tables: [
      { id: 'r1', name: 'Row 1', kind: 'row', seats: 6, x: 500, y: 180, rot: 0 },
      { id: 'r2', name: 'Row 2', kind: 'row', seats: 6, x: 500, y: 268, rot: 0 },
      { id: 'r3', name: 'Row 3', kind: 'row', seats: 6, x: 500, y: 356, rot: 0 },
      { id: 'r4', name: 'Row 4', kind: 'row', seats: 6, x: 500, y: 444, rot: 0 },
    ],
    fixtures: [
      { id: 'cf1', label: 'Teacher desk', x: 500, y: 66, w: 150, h: 52 },
      { id: 'cf2', label: 'Door', x: 236, y: 66, w: 64, h: 42 },
    ],
    guests,
    pairs,
    seating: {},
  };
}
