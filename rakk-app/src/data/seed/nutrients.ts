/** Added vitamins and minerals — the fortification block on cereal and bread labels. */
import { SeedIngredient } from './types';

export const NUTRIENTS: SeedIngredient[] = [
  {
    id: 'ing_thiamin_mononitrate', canonical_name: 'Thiamin mononitrate', aka: ['thiamine mononitrate'],
    cas_number: '532-43-4', category: 'other', origin: 'synthetic', typical_uses: ['food', 'pharmaceutical'],
    plain_explanation: 'A stable form of vitamin B1 added to flour and cereal. Refining removes most of the grain’s own B vitamins, and enrichment puts them back.',
    us: { status: 'Generally Recognized as Safe (GRAS)', cfr: '184.1878' },
  },
  {
    id: 'ing_riboflavin', canonical_name: 'Riboflavin', aka: ['E101'],
    cas_number: '83-88-5', e_number_ins_code: 'E101', category: 'other', origin: 'synthetic',
    plain_explanation: 'Vitamin B2, added to enriched flour and cereal. It is strongly yellow, so it doubles as a colouring.',
    us: { status: 'Generally Recognized as Safe (GRAS)', cfr: '184.1695' },
    eu: { status: 'Authorised food colour' },
  },
  {
    id: 'ing_niacinamide', canonical_name: 'Niacinamide', aka: ['nicotinamide'],
    cas_number: '98-92-0', category: 'other', origin: 'synthetic', typical_uses: ['food', 'cosmetics', 'pharmaceutical'],
    plain_explanation: 'A form of vitamin B3 used to enrich flour and cereal. Labels often describe it simply as "a B vitamin".',
    us: { status: 'Generally Recognized as Safe (GRAS)', cfr: '184.1535' },
  },
  {
    id: 'ing_pyridoxine_hcl', canonical_name: 'Pyridoxine hydrochloride', aka: ['pyridoxine'],
    cas_number: '58-56-0', category: 'other', origin: 'synthetic',
    plain_explanation: 'A stable salt form of vitamin B6 used to fortify cereals and drinks.',
    us: { status: 'Generally Recognized as Safe (GRAS)', cfr: '184.1676' },
  },
  {
    id: 'ing_folic_acid', canonical_name: 'Folic acid', aka: ['folate', 'pteroylglutamic acid'],
    cas_number: '59-30-3', category: 'other', origin: 'synthetic',
    plain_explanation: 'The synthetic form of folate. Enrichment of cereal grain products with it has been mandatory in the US since 1998.',
    us: { status: 'Permitted for addition to enriched grain products', cfr: '172.345' },
  },
  {
    id: 'ing_cyanocobalamin', canonical_name: 'Cyanocobalamin', aka: [],
    cas_number: '68-19-9', category: 'other', origin: 'synthetic',
    plain_explanation: 'The stable synthetic form of vitamin B12, used to fortify cereals and plant milks.',
    us: { status: 'Generally Recognized as Safe (GRAS)', cfr: '184.1945' },
  },
  {
    id: 'ing_vitamin_a_palmitate', canonical_name: 'Vitamin A palmitate', aka: ['retinyl palmitate', 'palmitate'],
    cas_number: '79-81-2', category: 'other', origin: 'synthetic', typical_uses: ['food', 'cosmetics'],
    plain_explanation: 'A stable form of vitamin A used to fortify milk, margarine and cereal.',
  },
  {
    id: 'ing_cholecalciferol', canonical_name: 'Cholecalciferol', aka: [],
    cas_number: '67-97-0', category: 'other', origin: 'natural', typical_uses: ['food', 'pharmaceutical'],
    plain_explanation: 'The form of vitamin D the skin makes in sunlight. It is added to milk, cereal and plant milks.',
    us: { status: 'Generally Recognized as Safe (GRAS) for specified uses', cfr: '184.1950' },
  },
  {
    id: 'ing_pantothenate', canonical_name: 'Calcium pantothenate', aka: ['pantothenic acid', 'd-calcium pantothenate'],
    cas_number: '137-08-6', category: 'other', origin: 'synthetic',
    plain_explanation: 'A stable salt of vitamin B5 used to fortify cereals and drinks.',
    us: { status: 'Generally Recognized as Safe (GRAS)', cfr: '184.1212' },
  },
  {
    id: 'ing_biotin', canonical_name: 'Biotin', aka: ['vitamin H'],
    cas_number: '58-85-5', category: 'other', origin: 'synthetic',
    plain_explanation: 'A B vitamin added to fortified foods and supplement drinks.',
  },
  {
    id: 'ing_ferrous_sulfate', canonical_name: 'Ferrous sulfate', aka: ['ferrous sulphate', 'iron sulfate'],
    cas_number: '7720-78-7', category: 'other', origin: 'synthetic', typical_uses: ['food', 'pharmaceutical'],
    plain_explanation: 'An iron salt used to fortify flour and cereal. It is well absorbed, but can affect colour and taste in some foods.',
    us: { status: 'Generally Recognized as Safe (GRAS)', cfr: '184.1315' },
  },
  {
    id: 'ing_reduced_iron', canonical_name: 'Reduced iron', aka: ['elemental iron', 'electrolytic iron', 'iron powder'],
    cas_number: '7439-89-6', category: 'other', origin: 'synthetic',
    plain_explanation: 'Finely powdered elemental iron used to enrich cereal and flour. It affects taste and colour less than iron salts.',
    us: { status: 'Generally Recognized as Safe (GRAS)', cfr: '184.1375' },
  },
  {
    id: 'ing_zinc_oxide', canonical_name: 'Zinc oxide', aka: [],
    cas_number: '1314-13-2', category: 'other', origin: 'synthetic', typical_uses: ['food', 'cosmetics', 'pharmaceutical'],
    plain_explanation: 'A zinc compound used to fortify cereals and formula, and as a mineral sunscreen in cosmetics.',
    us: { status: 'Generally Recognized as Safe (GRAS)', cfr: '182.8991' },
  },
  {
    id: 'ing_zinc_sulfate', canonical_name: 'Zinc sulfate', aka: ['zinc sulphate'],
    cas_number: '7733-02-0', category: 'other', origin: 'synthetic',
    plain_explanation: 'A soluble zinc salt used to fortify drinks and cereals.',
    us: { status: 'Generally Recognized as Safe (GRAS)', cfr: '182.8997' },
  },
  {
    id: 'ing_potassium_iodide', canonical_name: 'Potassium iodide', aka: ['iodide'],
    cas_number: '7681-11-0', category: 'other', origin: 'synthetic',
    plain_explanation: 'The compound that makes salt iodised. Adding it to table salt was introduced to prevent iodine-deficiency goitre.',
    us: { status: 'Generally Recognized as Safe (GRAS)', cfr: '184.1634' },
  },
  {
    id: 'ing_magnesium_oxide', canonical_name: 'Magnesium oxide', aka: ['magnesia', 'E530'],
    cas_number: '1309-48-4', e_number_ins_code: 'E530', category: 'other', origin: 'synthetic',
    plain_explanation: 'A magnesium compound used to fortify foods and to reduce acidity.',
    us: { status: 'Generally Recognized as Safe (GRAS)', cfr: '184.1431' },
  },
  {
    id: 'ing_copper_gluconate', canonical_name: 'Copper gluconate', aka: [],
    cas_number: '527-09-3', category: 'other', origin: 'synthetic',
    plain_explanation: 'A copper salt used in trace amounts to fortify formula and supplement drinks.',
    us: { status: 'Generally Recognized as Safe (GRAS)', cfr: '184.1260' },
  },
  {
    id: 'ing_manganese_sulfate', canonical_name: 'Manganese sulfate', aka: [],
    cas_number: '7785-87-7', category: 'other', origin: 'synthetic',
    plain_explanation: 'A manganese salt used in trace amounts to fortify formula and nutritional drinks.',
    us: { status: 'Generally Recognized as Safe (GRAS)', cfr: '184.1461' },
  },
  {
    id: 'ing_sodium_selenite', canonical_name: 'Sodium selenite', aka: [],
    cas_number: '10102-18-8', category: 'other', origin: 'synthetic',
    plain_explanation: 'A selenium compound added in very small amounts to formula and nutritional products.',
  },
  {
    id: 'ing_choline_bitartrate', canonical_name: 'Choline bitartrate', aka: ['choline'],
    cas_number: '87-67-2', category: 'other', origin: 'synthetic',
    plain_explanation: 'A source of choline, a nutrient grouped with the B vitamins, used in formula and supplement drinks.',
  },
  {
    id: 'ing_taurine', canonical_name: 'Taurine', aka: [],
    cas_number: '107-35-7', category: 'other', origin: 'synthetic',
    plain_explanation: 'An amino sulfonic acid found naturally in meat and fish, added to energy drinks and infant formula.',
  },
  {
    id: 'ing_inositol', canonical_name: 'Inositol', aka: ['myo-inositol'],
    cas_number: '87-89-8', category: 'other', origin: 'nature_identical',
    plain_explanation: 'A sugar-like compound found in whole grains, added to infant formula and energy drinks.',
  },
  {
    id: 'ing_ascorbyl_palmitate', canonical_name: 'Ascorbyl palmitate', aka: ['E304'],
    cas_number: '137-66-6', e_number_ins_code: 'E304', category: 'antioxidant', origin: 'synthetic',
    plain_explanation: 'A fat-soluble form of vitamin C, used as an antioxidant in oils where plain vitamin C would not dissolve.',
    us: { status: 'Generally Recognized as Safe (GRAS)', cfr: '182.3149' },
    eu: { status: 'Authorised food additive' },
  },
];
