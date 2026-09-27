/**
 * DESIGN FIXTURES — dev only, reachable from the states gallery.
 *
 * These are hand-written label texts run through the REAL matcher against the
 * REAL seed dataset, so they exercise the same path a live scan does. They
 * exist only so the Label screen's matched/flagged states can be reviewed
 * without hunting for a physical package.
 *
 * Product names and brands are invented; the label texts are written to look
 * like printed ingredients panels.
 */

import { ResolvedScan } from '../types/scan';
import { resolveScan } from '../services/matcher';
import { SEED_INGREDIENTS } from './seed';

interface Fixture {
  barcode: string;
  name: string;
  brand: string;
  raw: string;
}

const FIXTURES: Fixture[] = [
  {
    barcode: '0072250017152',
    name: 'Oat Crunch Granola',
    brand: 'Northfield Mills',
    raw:
      'Whole grain oats, cane sugar, sunflower oil, honey, rice flour, maltodextrin, ' +
      'soy lecithin, natural flavor, salt, mono- and diglycerides, mixed tocopherols, ' +
      'ascorbic acid, annatto extract.',
  },
  {
    barcode: '0016000275287',
    name: 'Sparkling Citrus Soda',
    brand: 'Ridgeline Beverages',
    raw:
      'Carbonated water, cane sugar, citric acid, natural flavor, sodium benzoate, ' +
      'potassium sorbate, sucralose, caramel color, ascorbic acid.',
  },
  {
    barcode: '0038000138416',
    name: 'Honey Nut Rings',
    brand: 'Vale Foods',
    raw:
      'Whole grain oats, cane sugar, honey, salt, mono- and diglycerides, maltodextrin, ' +
      'natural flavor, xanthan gum, mixed tocopherols, annatto extract.',
  },
  {
    barcode: '0885909950805',
    name: 'Almond Butter',
    brand: 'Stonefield Grove',
    raw: 'Dry roasted almonds, salt.',
  },
  {
    // Exercises the card variants that are hard to find on one real package:
    // an ingredient where US and EU disagree (titanium dioxide), one with no
    // regulatory entry on file (gelatin), and several dosage blocks.
    barcode: '0000000000001',
    name: 'Yogurt Coated Raisins',
    brand: 'Dev Fixture',
    raw:
      'Raisins, sugar, palm oil, whey, titanium dioxide, gelatin, carrageenan, ' +
      'carmine, polysorbate 80, soy lecithin, shellac.',
  },
];

export const MOCK_SCANS: ResolvedScan[] = FIXTURES.map((f, index) => {
  const scan = resolveScan(
    {
      id: `fixture_${index}`,
      barcode: f.barcode,
      name: f.name,
      brand: f.brand,
      image_url: null,
      raw_ingredient_text: f.raw,
    },
    SEED_INGREDIENTS,
  );
  // Stable ids so the dev gallery can link to them.
  return { ...scan, scan_id: `fixture_${index}` };
});

export const scanById = (id: string): ResolvedScan =>
  MOCK_SCANS.find((s) => s.scan_id === id) ?? MOCK_SCANS[0];
