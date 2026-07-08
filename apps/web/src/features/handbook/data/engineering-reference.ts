/**
 * @file engineering-reference.ts — static Engineering Constants & Tables.
 *
 * Standard reference facts (SI prefixes, conversions, material properties,
 * rebar/Manning/trig tables) for the Fundamentals Handbook. These are
 * universal engineering constants, NOT Knowledge Library educational content —
 * the Library owns concepts/formulas/questions; this file owns lookup data a
 * printed reference manual would carry in its appendix.
 */

export interface RefRow { label: string; value: string; note?: string }
export interface RefTable { id: string; title: string; columns: string[]; rows: string[][] }
export interface RefSection { id: string; title: string; rows?: RefRow[]; tables?: RefTable[] }

export const REFERENCE_SECTIONS: RefSection[] = [
  {
    id: 'constants',
    title: 'Physical Constants',
    rows: [
      { label: 'Gravitational acceleration, g', value: '9.81 m/s²', note: '32.2 ft/s²' },
      { label: 'Unit weight of water, γw', value: '9.81 kN/m³', note: '62.4 lb/ft³' },
      { label: 'Density of water, ρw', value: '1000 kg/m³', note: 'at 4 °C' },
      { label: 'Atmospheric pressure (std)', value: '101.325 kPa', note: '14.7 psi · 760 mmHg' },
      { label: 'Modulus of elasticity, steel Es', value: '200 GPa', note: '29 000 ksi (NSCP)' },
      { label: 'Modulus of elasticity, concrete Ec', value: '4700 √f′c MPa', note: 'normal-weight (NSCP 419)' },
      { label: 'Unit weight, structural steel', value: '77 kN/m³', note: '7850 kg/m³' },
      { label: 'Unit weight, reinforced concrete', value: '23.5–24 kN/m³', note: '2400 kg/m³' },
      { label: 'Unit weight, plain concrete', value: '23 kN/m³', note: '2300 kg/m³' },
      { label: 'Kinematic viscosity of water, ν', value: '1.004×10⁻⁶ m²/s', note: 'at 20 °C' },
      { label: 'Dynamic viscosity of water, μ', value: '1.002×10⁻³ Pa·s', note: 'at 20 °C' },
      { label: 'Specific gravity of mercury', value: '13.6', note: 'γ = 133.4 kN/m³' },
    ],
  },
  {
    id: 'prefixes',
    title: 'SI Prefixes',
    tables: [{
      id: 'si', title: 'SI Prefixes', columns: ['Prefix', 'Symbol', 'Factor'],
      rows: [
        ['giga', 'G', '10⁹'], ['mega', 'M', '10⁶'], ['kilo', 'k', '10³'],
        ['centi', 'c', '10⁻²'], ['milli', 'm', '10⁻³'], ['micro', 'μ', '10⁻⁶'], ['nano', 'n', '10⁻⁹'],
      ],
    }],
  },
  {
    id: 'conversions',
    title: 'Unit Conversions',
    tables: [{
      id: 'conv', title: 'Frequently Used Conversions', columns: ['From', 'To', 'Multiply by'],
      rows: [
        ['1 m', 'ft', '3.2808'], ['1 in', 'mm', '25.4'], ['1 mi', 'km', '1.6093'],
        ['1 hectare', 'm²', '10 000'], ['1 acre', 'm²', '4046.86'],
        ['1 L', 'm³', '0.001'], ['1 ft³', 'L', '28.317'], ['1 US gal', 'L', '3.7854'],
        ['1 kN', 'kgf', '101.97'], ['1 kip', 'kN', '4.4482'], ['1 lbf', 'N', '4.4482'],
        ['1 MPa', 'psi', '145.04'], ['1 kPa', 'psf', '20.885'], ['1 bar', 'kPa', '100'],
        ['1 hp', 'kW', '0.7457'], ['1 kWh', 'MJ', '3.6'],
        ['1 m³/s', 'L/s', '1000'], ['1 mgd (US)', 'm³/day', '3785.4'],
        ['1 rad', 'deg', '57.296'], ['1 knot', 'km/h', '1.852'],
      ],
    }],
  },
  {
    id: 'rebar',
    title: 'Reinforcing Bars (PH deformed bars)',
    tables: [{
      id: 'rsb', title: 'Rebar Properties', columns: ['Designation', 'Diameter (mm)', 'Area (mm²)', 'Mass (kg/m)'],
      rows: [
        ['10 mm', '10', '78.5', '0.617'], ['12 mm', '12', '113.1', '0.888'],
        ['16 mm', '16', '201.1', '1.578'], ['20 mm', '20', '314.2', '2.466'],
        ['25 mm', '25', '490.9', '3.853'], ['28 mm', '28', '615.8', '4.834'],
        ['32 mm', '32', '804.2', '6.313'], ['36 mm', '36', '1017.9', '7.990'],
      ],
    }],
  },
  {
    id: 'materials',
    title: 'Material Grades & Properties',
    tables: [
      {
        id: 'steelgrades', title: 'Reinforcement / Structural Steel Grades (PH practice)', columns: ['Grade', 'Fy (MPa)', 'Typical use'],
        rows: [
          ['Grade 33 (230)', '230', 'ties, stirrups, small bars'],
          ['Grade 40 (275)', '275', 'general reinforcement'],
          ['Grade 60 (415)', '415', 'main reinforcement'],
          ['A36 structural', '248', 'rolled shapes, plates'],
          ['A992 structural', '345', 'W-shapes (beams/columns)'],
        ],
      },
      {
        id: 'fc', title: 'Common Concrete Strengths', columns: ["f′c (MPa)", 'psi', 'Typical use'],
        rows: [
          ['17', '2500', 'non-structural'], ['21', '3000', 'slabs, footings'],
          ['28', '4000', 'beams, columns'], ['35', '5000', 'columns, prestressed'],
        ],
      },
      {
        id: 'unitweights', title: 'Typical Unit Weights', columns: ['Material', 'γ (kN/m³)'],
        rows: [
          ['Water', '9.81'], ['Plain concrete', '23'], ['Reinforced concrete', '24'],
          ['Structural steel', '77'], ['Dry sand', '16–18'], ['Saturated clay', '16–20'],
          ['Gravel', '19–22'], ['Asphalt pavement', '22.5'], ['CHB masonry', '21.2'], ['Timber (avg)', '6–8'],
        ],
      },
    ],
  },
  {
    id: 'manning',
    title: "Manning's Roughness Coefficients",
    tables: [{
      id: 'n', title: "Manning's n (typical)", columns: ['Surface', 'n'],
      rows: [
        ['Glass, PVC, HDPE', '0.009–0.011'], ['Smooth concrete', '0.012'],
        ['Ordinary concrete', '0.013'], ['Cast iron', '0.013–0.015'],
        ['Corrugated metal', '0.022–0.026'], ['Earth channel, clean', '0.022'],
        ['Earth channel, weedy', '0.030'], ['Natural stream, clean', '0.030'],
        ['Natural stream, brushy', '0.050–0.10'],
      ],
    }],
  },
  {
    id: 'trig',
    title: 'Exact Trigonometric Values',
    tables: [{
      id: 'trigvals', title: 'Special Angles', columns: ['θ', 'sin θ', 'cos θ', 'tan θ'],
      rows: [
        ['0°', '0', '1', '0'],
        ['30°', '1/2', '√3/2', '1/√3'],
        ['45°', '√2/2', '√2/2', '1'],
        ['60°', '√3/2', '1/2', '√3'],
        ['90°', '1', '0', '∞'],
      ],
    }],
  },
  {
    id: 'water',
    title: 'Water Properties vs Temperature',
    tables: [{
      id: 'waterprops', title: 'Water Properties', columns: ['T (°C)', 'ρ (kg/m³)', 'ν (×10⁻⁶ m²/s)', 'Pv (kPa)'],
      rows: [
        ['0', '999.8', '1.787', '0.611'],
        ['10', '999.7', '1.307', '1.228'],
        ['20', '998.2', '1.004', '2.339'],
        ['30', '995.7', '0.801', '4.243'],
        ['40', '992.2', '0.658', '7.376'],
      ],
    }],
  },
];
