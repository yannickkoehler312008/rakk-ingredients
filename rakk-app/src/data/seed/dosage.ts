/**
 * DOSAGE AND EXPOSURE CONTEXT — §1, §4, §11, §12.B2.
 *
 * §1 calls this "the single most defensible reason a user picks Rakk
 * Ingredients over a red/yellow/green scanner", and §9 forbids letting it slip
 * past v1. It is a separate layer from the category files because it comes
 * from a different kind of source — published risk assessments rather than the
 * CFR — is reviewed on its own cadence, and is prioritised by scan frequency
 * (§12.B2) rather than filled in alphabetically.
 *
 * ⚠️  THESE NUMBERS ARE NOT MACHINE-VERIFIED. The CFR citations elsewhere in
 *     the seed are checked against eCFR by scripts/verify-citations.mjs. There
 *     is no equivalent for ADIs: JECFA's database uses opaque internal ids with
 *     no usable search endpoint, so each figure here was written by hand and
 *     must be checked against the named assessment before launch.
 *
 *     What IS enforced (scripts/check-seed.mjs): §11's rule that no dosage
 *     statement exists without a traceable source. Every entry below carries
 *     `refs` naming the body and the evaluation the figure comes from.
 *
 * ON "ADI not specified": this is a real JECFA conclusion, not missing data. It
 * means the committee saw no need to set a numerical limit. Stating that is a
 * fact about the regulatory record, which is what §1 asks for — it is not a
 * statement that the substance is good for you.
 */

import { UsageContext } from '../../types/ingredient';

export interface DosageEntry {
  usage_context: UsageContext;
  refs: string[];
}

const ingested = (
  threshold_of_concern: string | null,
  typical_concentration_range: string,
  refs: string[],
): DosageEntry => ({
  usage_context: { threshold_of_concern, typical_concentration_range, product_type_context: 'ingested' },
  refs,
});

/** Keyed by ingredient id. Merged onto the record in ./index.ts. */
export const DOSAGE: Record<string, DosageEntry> = {
  // ─── Preservatives ───
  ing_potassium_benzoate: ingested(
    'Acceptable Daily Intake set at 0–5 mg per kg of body weight per day, as benzoic acid (JECFA)',
    '0.05–0.1% in soft drinks and dressings',
    ['JECFA, evaluation of benzoic acid and its salts — ADI 0–5 mg/kg body weight'],
  ),
  ing_calcium_sorbate: ingested(
    'Acceptable Daily Intake set at 0–25 mg per kg of body weight per day, as sorbic acid (JECFA)',
    '0.02–0.3% in cheese and baked goods',
    ['JECFA, evaluation of sorbic acid and its salts — ADI 0–25 mg/kg body weight'],
  ),
  ing_sulfur_dioxide: ingested(
    'Acceptable Daily Intake set at 0–0.7 mg per kg of body weight per day, as sulfur dioxide (JECFA)',
    'Up to 2,000 ppm in dried fruit; 10–350 ppm in wine',
    ['JECFA, evaluation of sulfur dioxide and sulfites — group ADI 0–0.7 mg/kg body weight'],
  ),
  ing_sodium_sulfite: ingested(
    'Acceptable Daily Intake set at 0–0.7 mg per kg of body weight per day, as sulfur dioxide (JECFA)',
    'Declarable above 10 ppm as sulfur dioxide',
    ['JECFA, evaluation of sulfur dioxide and sulfites — group ADI 0–0.7 mg/kg body weight'],
  ),
  ing_sodium_bisulfite: ingested(
    'Acceptable Daily Intake set at 0–0.7 mg per kg of body weight per day, as sulfur dioxide (JECFA)',
    'Declarable above 10 ppm as sulfur dioxide',
    ['JECFA, evaluation of sulfur dioxide and sulfites — group ADI 0–0.7 mg/kg body weight'],
  ),
  ing_sodium_metabisulfite: ingested(
    'Acceptable Daily Intake set at 0–0.7 mg per kg of body weight per day, as sulfur dioxide (JECFA)',
    'Up to 2,000 ppm in dried fruit',
    ['JECFA, evaluation of sulfur dioxide and sulfites — group ADI 0–0.7 mg/kg body weight'],
  ),
  ing_potassium_metabisulfite: ingested(
    'Acceptable Daily Intake set at 0–0.7 mg per kg of body weight per day, as sulfur dioxide (JECFA)',
    '10–350 ppm in wine',
    ['JECFA, evaluation of sulfur dioxide and sulfites — group ADI 0–0.7 mg/kg body weight'],
  ),
  ing_sodium_nitrate: ingested(
    'Acceptable Daily Intake set at 0–3.7 mg per kg of body weight per day, as nitrate ion (JECFA)',
    'Up to 500 ppm ingoing in cured meats in the US',
    ['JECFA, evaluation of nitrate — ADI 0–3.7 mg/kg body weight', 'EFSA, re-evaluation of nitrates (2017)'],
  ),
  ing_potassium_nitrate: ingested(
    'Acceptable Daily Intake set at 0–3.7 mg per kg of body weight per day, as nitrate ion (JECFA)',
    'Used in slow-cured meats and some cheeses',
    ['JECFA, evaluation of nitrate — ADI 0–3.7 mg/kg body weight'],
  ),
  ing_natamycin: {
    usage_context: {
      threshold_of_concern: 'Acceptable Daily Intake set at 0–0.3 mg per kg of body weight per day (JECFA)',
      typical_concentration_range: 'Applied to the surface only, typically under 20 mg per kg of cheese rind',
      product_type_context: 'ingested',
    },
    refs: ['JECFA, evaluation of natamycin (pimaricin) — ADI 0–0.3 mg/kg body weight'],
  },
  ing_edta: ingested(
    'Acceptable Daily Intake set at 0–2.5 mg per kg of body weight per day (JECFA)',
    '33–500 ppm in dressings, canned goods and soft drinks',
    ['JECFA, evaluation of calcium disodium EDTA — ADI 0–2.5 mg/kg body weight'],
  ),
  ing_propionic_acid: ingested(
    'JECFA concluded no numerical Acceptable Daily Intake was needed ("ADI not specified")',
    '0.1–0.4% in bread',
    ['JECFA, evaluation of propionic acid and its salts — ADI not specified'],
  ),
  ing_calcium_propionate: ingested(
    'JECFA concluded no numerical Acceptable Daily Intake was needed ("ADI not specified")',
    '0.1–0.4% of flour weight in packaged bread',
    ['JECFA, evaluation of propionic acid and its salts — ADI not specified'],
  ),
  ing_sodium_propionate: ingested(
    'JECFA concluded no numerical Acceptable Daily Intake was needed ("ADI not specified")',
    '0.1–0.4% of flour weight in baked goods',
    ['JECFA, evaluation of propionic acid and its salts — ADI not specified'],
  ),

  // ─── Antioxidants ───
  ing_tbhq: ingested(
    'Acceptable Daily Intake set at 0–0.7 mg per kg of body weight per day (JECFA)',
    'Up to 0.02% of the fat content in US food use',
    ['JECFA, evaluation of tertiary butylhydroquinone — ADI 0–0.7 mg/kg body weight'],
  ),
  ing_propyl_gallate: ingested(
    'Acceptable Daily Intake set at 0–1.4 mg per kg of body weight per day (JECFA)',
    'Up to 0.02% of the fat content in US food use',
    ['JECFA, evaluation of propyl gallate — ADI 0–1.4 mg/kg body weight'],
  ),
  ing_erythorbic_acid: ingested(
    'JECFA concluded no numerical Acceptable Daily Intake was needed ("ADI not specified")',
    '0.05–0.1% in cured meats',
    ['JECFA, evaluation of erythorbic acid — ADI not specified'],
  ),
  ing_ascorbic_acid: ingested(
    'JECFA concluded no numerical Acceptable Daily Intake was needed ("ADI not specified")',
    'Varies widely; also added as a nutrient rather than only as an antioxidant',
    ['JECFA, evaluation of ascorbic acid and its salts — ADI not specified'],
  ),

  // ─── Emulsifiers ───
  ing_soy_lecithin: ingested(
    'JECFA concluded no numerical Acceptable Daily Intake was needed ("ADI not specified")',
    '0.1–0.5% in chocolate and baked goods',
    ['JECFA, evaluation of lecithin — ADI not specified'],
  ),
  ing_lecithin: ingested(
    'JECFA concluded no numerical Acceptable Daily Intake was needed ("ADI not specified")',
    '0.1–0.5% in chocolate and baked goods',
    ['JECFA, evaluation of lecithin — ADI not specified'],
  ),
  ing_sunflower_lecithin: ingested(
    'JECFA concluded no numerical Acceptable Daily Intake was needed ("ADI not specified")',
    '0.1–0.5% in chocolate and baked goods',
    ['JECFA, evaluation of lecithin — ADI not specified'],
  ),
  ing_mono_diglycerides: ingested(
    'JECFA concluded no numerical Acceptable Daily Intake was needed ("ADI not specified")',
    '0.2–1% in baked goods',
    ['JECFA, evaluation of mono- and diglycerides of fatty acids — ADI not specified'],
  ),
  ing_polysorbate_80: ingested(
    'Group Acceptable Daily Intake set at 0–25 mg per kg of body weight per day for polysorbates (JECFA)',
    'Up to 0.1% in ice cream and dressings',
    ['JECFA, evaluation of polyoxyethylene sorbitan esters — group ADI 0–25 mg/kg body weight'],
  ),
  ing_polysorbate_60: ingested(
    'Group Acceptable Daily Intake set at 0–25 mg per kg of body weight per day for polysorbates (JECFA)',
    'Up to 0.4% in whipped toppings and icings',
    ['JECFA, evaluation of polyoxyethylene sorbitan esters — group ADI 0–25 mg/kg body weight'],
  ),
  ing_sorbitan_monostearate: ingested(
    'Group Acceptable Daily Intake set at 0–25 mg per kg of body weight per day for sorbitan esters (JECFA)',
    'Up to 1% in confectionery coatings',
    ['JECFA, evaluation of sorbitan esters of fatty acids — group ADI 0–25 mg/kg body weight'],
  ),
  ing_pgpr: ingested(
    'Acceptable Daily Intake set at 0–7.5 mg per kg of body weight per day (JECFA)',
    'Up to 0.5% in chocolate, and commonly far less',
    ['JECFA, evaluation of polyglycerol polyricinoleate — ADI 0–7.5 mg/kg body weight'],
  ),
  ing_polyglycerol_esters: ingested(
    'Acceptable Daily Intake set at 0–25 mg per kg of body weight per day (JECFA)',
    '0.2–1% in cake batters and aerated toppings',
    ['JECFA, evaluation of polyglycerol esters of fatty acids — ADI 0–25 mg/kg body weight'],
  ),
  ing_datem: ingested(
    'Acceptable Daily Intake set at 0–50 mg per kg of body weight per day (JECFA)',
    '0.2–0.6% of flour weight in bread',
    ['JECFA, evaluation of diacetyl tartaric acid esters of mono- and diglycerides — ADI 0–50 mg/kg body weight'],
  ),
  ing_ssl: ingested(
    'Group Acceptable Daily Intake set at 0–20 mg per kg of body weight per day for stearoyl lactylates (JECFA)',
    'Up to 0.5% of flour weight in bread',
    ['JECFA, evaluation of sodium and calcium stearoyl lactylates — group ADI 0–20 mg/kg body weight'],
  ),
  ing_csl: ingested(
    'Group Acceptable Daily Intake set at 0–20 mg per kg of body weight per day for stearoyl lactylates (JECFA)',
    'Up to 0.5% of flour weight in baked goods',
    ['JECFA, evaluation of sodium and calcium stearoyl lactylates — group ADI 0–20 mg/kg body weight'],
  ),
  ing_sucrose_esters: ingested(
    'Acceptable Daily Intake set at 0–30 mg per kg of body weight per day (JECFA)',
    '0.1–0.5% in baked goods and beverages',
    ['JECFA, evaluation of sucrose esters of fatty acids — ADI 0–30 mg/kg body weight'],
  ),

  // ─── Thickeners ───
  ing_carrageenan: ingested(
    'EFSA set an Acceptable Daily Intake of 75 mg per kg of body weight per day in its 2018 re-evaluation',
    '0.01–0.5% in dairy drinks and desserts',
    ['EFSA ANS Panel, re-evaluation of carrageenan (E407) and processed Eucheuma seaweed (E407a), 2018'],
  ),
  ing_xanthan_gum: ingested(
    'JECFA concluded no numerical Acceptable Daily Intake was needed ("ADI not specified")',
    '0.05–0.5% in sauces, dressings and gluten-free baking',
    ['JECFA, evaluation of xanthan gum — ADI not specified'],
  ),
  ing_guar_gum: ingested(
    'JECFA concluded no numerical Acceptable Daily Intake was needed ("ADI not specified")',
    '0.1–1% in ice cream and sauces',
    ['JECFA, evaluation of guar gum — ADI not specified'],
  ),
  ing_pectin: ingested(
    'JECFA concluded no numerical Acceptable Daily Intake was needed ("ADI not specified")',
    '0.5–1.5% in jams and fruit fillings',
    ['JECFA, evaluation of pectins — ADI not specified'],
  ),
  ing_gellan_gum: ingested(
    'JECFA concluded no numerical Acceptable Daily Intake was needed ("ADI not specified")',
    '0.01–0.1% in plant milks and jellies',
    ['JECFA, evaluation of gellan gum — ADI not specified'],
  ),
  ing_gum_arabic: ingested(
    'JECFA concluded no numerical Acceptable Daily Intake was needed ("ADI not specified")',
    '0.1–2% in soft drinks and confectionery coatings',
    ['JECFA, evaluation of gum arabic (acacia gum) — ADI not specified'],
  ),
  ing_cmc: ingested(
    'JECFA concluded no numerical Acceptable Daily Intake was needed ("ADI not specified")',
    '0.1–0.5% in frozen desserts and drinks',
    ['JECFA, evaluation of sodium carboxymethyl cellulose — ADI not specified'],
  ),

  // ─── Sweeteners ───
  ing_saccharin: ingested(
    'Acceptable Daily Intake set at 0–5 mg per kg of body weight per day (JECFA)',
    '0.005–0.03% in table-top sweeteners and drinks',
    ['JECFA, evaluation of saccharin and its salts — ADI 0–5 mg/kg body weight'],
  ),
  ing_neotame: ingested(
    'Acceptable Daily Intake set at 0–2 mg per kg of body weight per day (JECFA)',
    'Used in very small amounts; far sweeter than aspartame',
    ['JECFA, evaluation of neotame — ADI 0–2 mg/kg body weight'],
  ),
  ing_sorbitol: ingested(
    'No numerical Acceptable Daily Intake; in the EU, products above 10% must state that excess may have a laxative effect',
    'Up to 30% in sugar-free confectionery',
    ['JECFA, evaluation of sorbitol — ADI not specified', 'EU Regulation 1333/2008, Annex III labelling requirement'],
  ),
  ing_xylitol: ingested(
    'No numerical Acceptable Daily Intake; in the EU, products above 10% must state that excess may have a laxative effect',
    'Up to 50% in chewing gum',
    ['JECFA, evaluation of xylitol — ADI not specified', 'EU Regulation 1333/2008, Annex III labelling requirement'],
  ),
  ing_erythritol: ingested(
    'JECFA concluded no numerical Acceptable Daily Intake was needed ("ADI not specified")',
    'Up to 30% in sugar-free confectionery and drinks',
    ['JECFA, evaluation of erythritol — ADI not specified'],
  ),
  ing_maltitol: ingested(
    'No numerical Acceptable Daily Intake; in the EU, products above 10% must state that excess may have a laxative effect',
    'Up to 50% in sugar-free chocolate',
    ['JECFA, evaluation of maltitol — ADI not specified', 'EU Regulation 1333/2008, Annex III labelling requirement'],
  ),

  // ─── Colours ───
  ing_yellow_5: ingested(
    'Acceptable Daily Intake set at 0–10 mg per kg of body weight per day (JECFA)',
    '10–300 ppm depending on the product',
    ['JECFA, evaluation of tartrazine — ADI 0–10 mg/kg body weight', 'EFSA, re-evaluation of tartrazine (E102), 2009'],
  ),
  ing_yellow_6: ingested(
    'Acceptable Daily Intake set at 0–4 mg per kg of body weight per day (JECFA)',
    '10–300 ppm depending on the product',
    ['JECFA, evaluation of sunset yellow FCF — ADI 0–4 mg/kg body weight'],
  ),
  ing_blue_1: ingested(
    'EFSA set an Acceptable Daily Intake of 6 mg per kg of body weight per day in its 2010 re-evaluation',
    '10–200 ppm depending on the product',
    ['EFSA ANS Panel, re-evaluation of Brilliant Blue FCF (E133), 2010'],
  ),
  ing_blue_2: ingested(
    'EFSA set an Acceptable Daily Intake of 5 mg per kg of body weight per day in its 2014 re-evaluation',
    '10–200 ppm depending on the product',
    ['EFSA ANS Panel, re-evaluation of indigo carmine (E132), 2014'],
  ),
  ing_red_3: ingested(
    'Acceptable Daily Intake set at 0–0.1 mg per kg of body weight per day (JECFA)',
    'Permitted uses are narrower than for other certified colours',
    ['JECFA, evaluation of erythrosine — ADI 0–0.1 mg/kg body weight'],
  ),
  ing_carmine: ingested(
    'Acceptable Daily Intake set at 0–5 mg per kg of body weight per day, as carminic acid (JECFA)',
    '10–500 ppm depending on the product',
    ['JECFA, evaluation of carmines — ADI 0–5 mg/kg body weight as carminic acid'],
  ),
  ing_annatto: ingested(
    'Acceptable Daily Intake set at 0–12 mg per kg of body weight per day, as bixin (JECFA)',
    '1–20 ppm in cheese, butter and snack coatings',
    ['JECFA, evaluation of annatto extracts — ADI 0–12 mg/kg body weight as bixin'],
  ),
  ing_beta_carotene: ingested(
    'Acceptable Daily Intake set at 0–5 mg per kg of body weight per day, as the sum of carotenoids (JECFA)',
    '1–25 ppm as a colour',
    ['JECFA, evaluation of beta-carotene — ADI 0–5 mg/kg body weight'],
  ),
  ing_titanium_dioxide: ingested(
    'No Acceptable Daily Intake could be established: EFSA concluded in 2021 that genotoxicity could not be ruled out, and the EU withdrew its food authorisation in 2022. It remains a permitted colour additive in the US.',
    'Up to 1% by weight where permitted',
    ['EFSA, safety assessment of titanium dioxide (E171) as a food additive, 2021', 'Commission Regulation (EU) 2022/63'],
  ),
  ing_caramel_color: ingested(
    'JECFA concluded no numerical Acceptable Daily Intake was needed for plain caramel (Class I); the ammonia and sulfite processes have their own limits',
    '50–5,000 ppm depending on the product',
    ['JECFA, evaluation of caramel colours — Class I ADI not specified'],
  ),

  // ─── Flavour enhancers, acids, misc ───
  ing_msg: ingested(
    'JECFA concluded no numerical Acceptable Daily Intake was needed ("ADI not specified")',
    '0.1–0.8% in savoury products',
    ['JECFA, evaluation of L-glutamic acid and its salts — ADI not specified'],
  ),
  ing_disodium_inosinate: ingested(
    'JECFA concluded no numerical Acceptable Daily Intake was needed ("ADI not specified")',
    'Typically under 0.1%, alongside glutamate',
    ['JECFA, evaluation of inosinic acid and its salts — ADI not specified'],
  ),
  ing_disodium_guanylate: ingested(
    'JECFA concluded no numerical Acceptable Daily Intake was needed ("ADI not specified")',
    'Typically under 0.1%, alongside glutamate',
    ['JECFA, evaluation of guanylic acid and its salts — ADI not specified'],
  ),
  ing_citric_acid: ingested(
    'JECFA concluded no numerical Acceptable Daily Intake was needed ("ADI not specified")',
    '0.1–1% in drinks and confectionery',
    ['JECFA, evaluation of citric acid — ADI not specified'],
  ),
  ing_phosphoric_acid: ingested(
    'EFSA set a group Acceptable Daily Intake for phosphates of 40 mg per kg of body weight per day, expressed as phosphorus (2019)',
    '0.03–0.06% in cola drinks',
    ['EFSA, re-evaluation of phosphoric acid and phosphates (E338–E341, E343, E450–E452), 2019'],
  ),
  ing_sodium_phosphate: ingested(
    'EFSA set a group Acceptable Daily Intake for phosphates of 40 mg per kg of body weight per day, expressed as phosphorus (2019)',
    '0.1–0.5% in processed cheese and meats',
    ['EFSA, re-evaluation of phosphoric acid and phosphates (E338–E341, E343, E450–E452), 2019'],
  ),
  ing_potassium_phosphate: ingested(
    'EFSA set a group Acceptable Daily Intake for phosphates of 40 mg per kg of body weight per day, expressed as phosphorus (2019)',
    'Typically under 0.5% in cereals and drinks',
    ['EFSA, re-evaluation of phosphoric acid and phosphates (E338–E341, E343, E450–E452), 2019'],
  ),
  ing_silicon_dioxide: ingested(
    'JECFA concluded no numerical Acceptable Daily Intake was needed ("ADI not specified")',
    'Up to 2% by weight in dry powders',
    ['JECFA, evaluation of silicon dioxide (amorphous) — ADI not specified'],
  ),
  ing_propylene_glycol: ingested(
    'Acceptable Daily Intake set at 0–25 mg per kg of body weight per day (JECFA)',
    'Up to 5% as a carrier for flavours and colours',
    ['JECFA, evaluation of propylene glycol — ADI 0–25 mg/kg body weight'],
  ),
  ing_polydextrose: ingested(
    'JECFA concluded no numerical Acceptable Daily Intake was needed ("ADI not specified")',
    'Up to 10% as a bulking agent; large amounts may have a laxative effect',
    ['JECFA, evaluation of polydextrose — ADI not specified'],
  ),
};
