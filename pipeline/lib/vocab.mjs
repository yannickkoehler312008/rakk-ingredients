/**
 * Fixed vocabularies the build uses to turn source codes into app fields.
 *
 * These are the ONLY hand-written words that reach bulk rows. They are a
 * closed, reviewable set (one line per FDA technical effect), not per-
 * ingredient prose — so reviewing this file once reviews every templated
 * explanation in the database. Wording follows §9's copy discipline: states
 * what a substance does, never whether that is good or bad.
 */

/**
 * 21 CFR 170.3(o) technical effects → [category, plain-English purpose].
 * Keys are the FDA inventory's own spelling. Order = precedence when a
 * substance has several effects: the most specific, label-relevant purpose
 * first; flavouring last among food effects because the inventory attaches
 * it to almost everything.
 */
export const EFFECTS = [
  ['COLOR OR COLORING ADJUNCT', 4, 'colorant', 'add, keep or enhance colour'],
  ['NON-NUTRITIVE SWEETENER', 19, 'sweetener', 'sweeten, with under 2 percent of the calories of the same sweetness from sugar'],
  ['NUTRITIVE SWEETENER', 21, 'sweetener', 'sweeten, while also providing calories'],
  ['ANTIMICROBIAL AGENT', 2, 'preservative', 'slow the growth of microorganisms such as mould, yeast and bacteria'],
  ['CURING OR PICKLING AGENT', 5, 'preservative', 'cure or pickle food, adding flavour or colour and extending shelf life'],
  ['ANTIOXIDANT', 3, 'antioxidant', 'slow the changes oxygen causes, such as fats turning rancid or cut surfaces browning'],
  ['EMULSIFIER OR EMULSIFIER SALT', 8, 'emulsifier', 'help oil and water stay evenly mixed'],
  ['STABILIZER OR THICKENER', 28, 'thickener', 'thicken food or keep its texture stable'],
  ['TEXTURIZER', 32, 'thickener', 'give food a particular texture or mouthfeel'],
  ['LEAVENING AGENT', 17, 'leavening_agent', 'release gas that makes dough and batter rise'],
  ['PH CONTROL AGENT', 23, 'acidity_regulator', 'set or hold the acidity of food'],
  ['NUTRIENT SUPPLEMENT', 20, 'other', 'add a nutrient, such as a vitamin or mineral'],
  ['ENZYME', 9, 'other', 'speed up a specific reaction during processing'],
  ['DOUGH STRENGTHENER', 6, 'other', 'strengthen dough by modifying its starch and gluten'],
  ['FLOUR TREATING AGENT', 13, 'other', 'treat milled flour to change its colour or baking qualities'],
  ['FIRMING AGENT', 10, 'other', 'keep fruit and vegetables firm or crisp'],
  ['HUMECTANT', 16, 'other', 'help food hold on to moisture'],
  ['ANTICAKING AGENT OR FREE-FLOW AGENT', 1, 'other', 'stop powders clumping so they flow freely'],
  ['SEQUESTRANT', 26, 'other', 'bind trace metals that would otherwise affect quality or stability'],
  ['FORMULATION AID', 14, 'filler', 'act as a carrier, binder, filler or similar aid to give food its intended form'],
  ['DRYING AGENT', 7, 'other', 'absorb moisture'],
  ['SURFACE-ACTIVE AGENT', 29, 'emulsifier', 'change how liquids wet, foam or spread'],
  ['SURFACE-FINISHING AGENT', 30, 'other', 'glaze, polish or protect the surface of food'],
  ['LUBRICANT OR RELEASE AGENT', 18, 'other', 'stop food sticking to surfaces during processing'],
  ['SOLVENT OR VEHICLE', 27, 'other', 'dissolve or carry other ingredients, such as flavours or colours'],
  ['SYNERGIST', 31, 'other', 'strengthen the effect of another ingredient'],
  ['OXIDIZING OR REDUCING AGENT', 22, 'other', 'chemically oxidise or reduce another ingredient during processing'],
  ['PROPELLANT', 25, 'other', 'propel or aerate food, as in aerosol toppings'],
  ['PROCESSING AID', 24, 'other', 'help during processing, for example to clarify or filter'],
  ['FLAVOR ENHANCER', 11, 'flavor', 'strengthen or round out the existing taste or aroma of food'],
  ['FLAVORING AGENT OR ADJUVANT', 12, 'flavor', 'add or help carry flavour'],
  ['FUMIGANT', 15, 'other', 'control insects and pests in stored food'],
  ['MASTICATORY SUBSTANCE', null, 'other', 'form part of chewing gum base'],
  ['MALTING OR FERMENTING AID', null, 'other', 'help control malting or fermentation'],
  ['FREEZING OR COOLING AGENT', null, 'other', 'freeze or chill food by direct contact'],
  ['WASHING OR SURFACE REMOVAL AGENT', null, 'other', 'wash or peel produce'],
  ['BOILER WATER ADDITIVE', null, 'other', 'treat water in steam boilers whose steam touches food'],
  ['TRACER', null, 'other', 'act as a tracer'],
];

export const EFFECT_BY_NAME = new Map(EFFECTS.map((e, i) => [e[0], { rank: i, cfr: e[1], category: e[2], purpose: e[3] }]));
export const EFFECT_BY_CFR = new Map(EFFECTS.filter((e) => e[1]).map((e, i) => [e[1], e[0]]));

/**
 * US status wording per 21 CFR part. Each phrase restates the PART'S OWN
 * TITLE (verified against eCFR at build time), so the status is the
 * regulation's classification in plain words, not an interpretation.
 */
export const US_PART_STATUS = {
  '73': ['Listed color additive, exempt from certification', /LISTING OF COLOR ADDITIVES EXEMPT FROM CERTIFICATION/],
  '74': ['Listed color additive, subject to certification', /LISTING OF COLOR ADDITIVES SUBJECT TO CERTIFICATION/],
  '81': ['Color additive provisionally listed', /GENERAL SPECIFICATIONS AND GENERAL RESTRICTIONS FOR PROVISIONAL COLOR ADDITIVES/],
  '82': ['Color additive provisionally listed', /LISTING OF CERTIFIED PROVISIONALLY LISTED COLORS/],
  '172': ['Permitted for direct addition to food, under the conditions in the regulation', /FOOD ADDITIVES PERMITTED FOR DIRECT ADDITION TO FOOD/],
  '173': ['Permitted as a secondary direct food additive, under the conditions in the regulation', /SECONDARY DIRECT FOOD ADDITIVES/],
  '180': ['Permitted in food on an interim basis, pending additional study', /INTERIM BASIS PENDING ADDITIONAL STUDY/],
  '181': ['Prior-sanctioned food ingredient', /PRIOR-SANCTIONED/],
  '182': ['Generally recognized as safe (GRAS)', /SUBSTANCES GENERALLY RECOGNIZED AS SAFE/],
  '184': ['Affirmed by FDA as generally recognized as safe (GRAS)', /DIRECT FOOD SUBSTANCES AFFIRMED AS GENERALLY RECOGNIZED AS SAFE/],
  '186': ['Affirmed as GRAS for indirect use only (packaging and food contact)', /INDIRECT FOOD SUBSTANCES AFFIRMED AS GENERALLY RECOGNIZED AS SAFE/],
  '175': ['Permitted only in food-contact materials (adhesives and coatings), not as a food ingredient', /INDIRECT FOOD ADDITIVES: ADHESIVES AND COMPONENTS OF COATINGS/],
  '176': ['Permitted only in food-contact materials (paper and paperboard), not as a food ingredient', /INDIRECT FOOD ADDITIVES: PAPER AND PAPERBOARD COMPONENTS/],
  '177': ['Permitted only in food-contact materials (polymers), not as a food ingredient', /INDIRECT FOOD ADDITIVES: POLYMERS/],
  '178': ['Permitted only in food-contact materials, not as a food ingredient', /INDIRECT FOOD ADDITIVES: ADJUVANTS, PRODUCTION AIDS, AND SANITIZERS/],
  '189': ['Prohibited from use in human food', /SUBSTANCES PROHIBITED FROM USE IN HUMAN FOOD/],
};

/**
 * Which US citation represents the substance when it has several. Direct food
 * uses outrank food-contact ones; a prohibition outranks everything, because
 * it is the fact a reader most needs.
 */
export const US_PART_PRIORITY = ['189', '73', '74', '184', '182', '172', '180', '173', '81', '82', '181', '186', '175', '176', '177', '178'];

/**
 * Allergen categories, derived from a name only where the name states the
 * source outright ("whey protein", "soy lecithin"). §15 flags allergen claims
 * as the sharpest liability, so these are narrow on purpose and every derived
 * flag is listed in the build report for human review.
 */
export const ALLERGEN_RULES = [
  ['milk', /\b(milk|whey|casein|caseinates?|lactose|lactalbumin|lactoglobulin|butterfat|butter (fat|oil|acids|esters|starter distillate)|cheese|buttermilk|ghee)\b/, /\b(milk thistle|coconut milk|milk of lime|milk of magnesia|milk[- ]clotting|milkweed|(cocoa|shea|nutmeg|mango|kokum|illipe|sal|avocado|almond|peanut|cashew|apple|cupuacu) butter)\b/],
  ['egg', /\b(eggs?|egg yolk|albumen|ovalbumin|lysozyme)\b/, /\beggplant\b/],
  ['fish', /\b(fish|cod liver|anchovy|tuna|salmon|sardine|isinglass|menhaden)\b/, null],
  ['crustacean_shellfish', /\b(shrimp|crab|lobster|crayfish|prawn|krill)\b/, null],
  ['tree_nut', /\b(almonds?|walnuts?|hazelnuts?|cashews?|pecans?|pistachios?|macadamia|brazil nuts?|filberts?)\b/, null],
  ['peanut', /\b(peanuts?|arachis)\b/, null],
  ['wheat', /\bwheat\b/, /\bbuckwheat\b/],
  ['soybean', /\b(soy|soya|soybeans?)\b/, null],
  ['sesame', /\bsesame\b/, null],
  // Caramels made with sulfite compounds, and sulfite-modified resins, are not
  // themselves sulfites; the name alone does not establish residual sulfite.
  ['sulfites', /\b(sulfites?|sulphites?|bisulfites?|bisulphites?|metabisulfites?|metabisulphites?|sulfur dioxide|sulphur dioxide|sulfurous acid|sulphurous acid)\b/, /\b(caramel|sulfite-modified|sulphite-modified)\b/],
];

/** Single words that are never, on their own, an ingredient identity. */
export const GENERIC_NAMES = new Set(['oil', 'oils', 'extract', 'protein', 'powder', 'fiber', 'fibre', 'flour', 'enzyme', 'enzymes', 'preparation', 'mixture', 'blend', 'concentrate', 'isolate', 'hydrolysate', 'juice', 'water', 'salt', 'sugar', 'starch', 'gum', 'fat', 'fats', 'meal', 'seed', 'seeds', 'leaf', 'leaves', 'root', 'bark', 'color', 'colour', 'flavor', 'flavour', 'vitamin', 'mineral', 'minerals', 'natural', 'strain', 'culture', 'cultures', 'biomass', 'syrup']);
