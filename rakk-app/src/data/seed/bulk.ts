/** Sugars and syrups, starches, fibres, proteins, processed fats and enzymes. */
import { SeedIngredient } from './types';

export const BULK: SeedIngredient[] = [
  // ─── Sugars and syrups ───
  {
    id: 'ing_hfcs', canonical_name: 'High fructose corn syrup', aka: ['HFCS', 'high-fructose corn syrup', 'glucose-fructose syrup', 'isoglucose'],
    category: 'sweetener', origin: 'synthetic',
    plain_explanation: 'Corn syrup in which some glucose has been converted to fructose, giving a sweetness close to table sugar in liquid form.',
    us: { status: 'Generally Recognized as Safe (GRAS)', cfr: '184.1866' },
  },
  {
    id: 'ing_corn_syrup', canonical_name: 'Corn syrup', aka: ['glucose syrup', 'corn syrup solids', 'dried glucose syrup'],
    category: 'sweetener', origin: 'natural',
    plain_explanation: 'A syrup of glucose made by breaking down corn starch. It sweetens and stops sugar crystallising in confectionery.',
    us: { status: 'Generally Recognized as Safe (GRAS)', cfr: '184.1865' },
  },
  {
    id: 'ing_dextrose', canonical_name: 'Dextrose', aka: ['glucose', 'd-glucose', 'corn sugar'],
    cas_number: '50-99-7', category: 'sweetener', origin: 'natural',
    plain_explanation: 'Glucose in crystalline form, about 70% as sweet as table sugar. It is used for bulk, browning and as a carrier for other ingredients.',
    us: { status: 'Generally Recognized as Safe (GRAS)', cfr: '184.1857' },
  },
  {
    id: 'ing_fructose', canonical_name: 'Fructose', aka: ['fruit sugar', 'crystalline fructose', 'levulose'],
    cas_number: '57-48-7', category: 'sweetener', origin: 'natural',
    plain_explanation: 'The sugar found in fruit and honey. It is sweeter than table sugar, so less is needed for the same effect.',
    us: { status: 'Generally Recognized as Safe (GRAS)', cfr: '184.1866' },
  },
  {
    id: 'ing_invert_sugar', canonical_name: 'Invert sugar', aka: ['invert syrup', 'inverted sugar syrup'],
    category: 'sweetener', origin: 'natural',
    plain_explanation: 'Table sugar split into glucose and fructose. It resists crystallising, which keeps soft sweets and icings smooth.',
    us: { status: 'Generally Recognized as Safe (GRAS)', cfr: '184.1859' },
  },
  {
    id: 'ing_brown_rice_syrup', canonical_name: 'Brown rice syrup', aka: ['rice syrup', 'rice malt syrup'],
    category: 'sweetener', origin: 'natural',
    plain_explanation: 'A syrup made by breaking rice starch down into sugars with enzymes. It is mildly sweet and mostly glucose.',
  },
  {
    id: 'ing_tapioca_syrup', canonical_name: 'Tapioca syrup', aka: ['tapioca starch syrup'],
    category: 'sweetener', origin: 'natural',
    plain_explanation: 'A syrup made by breaking cassava starch down into sugars, used where a corn-free sweetener is wanted.',
  },
  {
    id: 'ing_malt_extract', canonical_name: 'Malt extract', aka: ['barley malt extract', 'malted barley extract'],
    category: 'flavor', origin: 'natural', allergen_flags: ['wheat'],
    plain_explanation: 'A syrup from sprouted barley, used for sweetness, colour and a characteristic malty taste.',
  },
  // ─── Starches, flours, fibres ───
  {
    id: 'ing_maltodextrin', canonical_name: 'Maltodextrin', aka: ['corn maltodextrin', 'tapioca maltodextrin'],
    cas_number: '9050-36-6', category: 'filler', origin: 'natural', typical_uses: ['food', 'pharmaceutical'],
    plain_explanation: 'A lightly processed starch, usually from corn. It adds bulk, carries flavourings and powders, and keeps dry mixes from clumping.',
    us: { status: 'Generally Recognized as Safe (GRAS)', cfr: '184.1444' },
  },
  {
    id: 'ing_inulin', canonical_name: 'Inulin', aka: ['chicory root fiber', 'chicory root fibre', 'agave inulin'],
    cas_number: '9005-80-5', category: 'filler', origin: 'natural',
    plain_explanation: 'A plant fibre from chicory root. It is not digested in the small intestine, so it counts as fibre and adds bulk and mild sweetness.',
  },
  {
    id: 'ing_polydextrose', canonical_name: 'Polydextrose', aka: ['E1200'],
    cas_number: '68424-04-4', e_number_ins_code: 'E1200', category: 'filler', origin: 'synthetic',
    plain_explanation: 'A synthetic fibre made from glucose, used to replace sugar and fat bulk while adding fibre.',
    us: { status: 'Permitted as a direct food additive', cfr: '172.841' },
    eu: { status: 'Authorised food additive' },
  },
  {
    id: 'ing_soluble_corn_fiber', canonical_name: 'Soluble corn fiber', aka: ['soluble corn fibre', 'resistant maltodextrin', 'corn fiber'],
    category: 'filler', origin: 'synthetic',
    plain_explanation: 'Corn starch processed so the body cannot digest most of it, letting it count as fibre while behaving like a syrup.',
  },
  {
    id: 'ing_cellulose_powder', canonical_name: 'Powdered cellulose', aka: ['cellulose', 'wood pulp cellulose', 'E460ii'],
    category: 'filler', origin: 'natural',
    plain_explanation: 'Purified plant fibre ground to a powder. It adds bulk and fibre and stops shredded cheese clumping.',
    // Was cited to 21 CFR 182.90 — substances migrating from paper PACKAGING,
    // not a food-ingredient listing. Removed in Phase 2.
  },
  // ─── Proteins ───
  {
    id: 'ing_whey', canonical_name: 'Whey', aka: ['whey powder', 'sweet whey', 'whey solids'],
    category: 'other', origin: 'natural', allergen_flags: ['milk'],
    plain_explanation: 'The liquid left after milk curdles, usually dried to a powder. It adds milk protein, browning and a mild dairy taste.',
  },
  {
    id: 'ing_whey_protein_concentrate', canonical_name: 'Whey protein concentrate', aka: ['WPC', 'whey protein', 'whey protein isolate'],
    category: 'other', origin: 'natural', allergen_flags: ['milk'],
    plain_explanation: 'Whey with most of the lactose and fat removed, leaving mainly protein.',
  },
  {
    id: 'ing_sodium_caseinate', canonical_name: 'Sodium caseinate', aka: ['caseinate', 'calcium caseinate', 'casein'],
    cas_number: '9005-46-3', category: 'emulsifier', origin: 'natural', allergen_flags: ['milk'],
    plain_explanation: 'The main protein of milk in a soluble form. It binds fat and water, which is why it appears in coffee whiteners and processed meats.',
  },
  {
    id: 'ing_milk_protein_concentrate', canonical_name: 'Milk protein concentrate', aka: ['MPC', 'milk protein isolate'],
    category: 'other', origin: 'natural', allergen_flags: ['milk'],
    plain_explanation: 'Milk with the water and most lactose removed, concentrating both casein and whey protein.',
  },
  {
    id: 'ing_soy_protein_isolate', canonical_name: 'Soy protein isolate', aka: ['soy protein', 'isolated soy protein', 'soya protein'],
    category: 'other', origin: 'natural', allergen_flags: ['soybean'],
    plain_explanation: 'Soybean protein with the fat and carbohydrate removed. It binds water and gives structure to meat substitutes and bars.',
  },
  {
    id: 'ing_pea_protein', canonical_name: 'Pea protein', aka: ['pea protein isolate', 'yellow pea protein'],
    category: 'other', origin: 'natural',
    plain_explanation: 'Protein extracted from yellow peas, used in plant milks, bars and meat substitutes.',
  },
  {
    id: 'ing_wheat_gluten', canonical_name: 'Vital wheat gluten', aka: ['wheat gluten', 'seitan', 'gluten'],
    category: 'other', origin: 'natural', allergen_flags: ['wheat'],
    plain_explanation: 'The stretchy protein of wheat, isolated and dried. It strengthens dough and is the basis of seitan.',
  },
  // ─── Fats and oils ───
  {
    id: 'ing_palm_oil', canonical_name: 'Palm oil', aka: ['palm fruit oil', 'palm olein', 'palm kernel oil'],
    cas_number: '8002-75-3', category: 'other', origin: 'natural', typical_uses: ['food', 'cosmetics'],
    plain_explanation: 'Oil pressed from the fruit of the oil palm. It is semi-solid at room temperature, which is why it replaced partially hydrogenated oils in many products.',
  },
  {
    id: 'ing_soybean_oil', canonical_name: 'Soybean oil', aka: ['soy oil', 'soya oil'],
    cas_number: '8001-22-7', category: 'other', origin: 'natural',
    plain_explanation: 'Oil pressed from soybeans and the most widely used vegetable oil in US processed food. Highly refined soybean oil is exempt from allergen labelling.',
  },
  {
    id: 'ing_interesterified_oil', canonical_name: 'Interesterified soybean oil', aka: ['interesterified oil', 'interesterified fat'],
    category: 'other', origin: 'synthetic',
    plain_explanation: 'Oil whose fatty acids have been rearranged to make it solid at room temperature without producing trans fat.',
  },
  {
    id: 'ing_mct_oil', canonical_name: 'Medium chain triglycerides', aka: ['MCT oil', 'MCTs', 'caprylic triglyceride'],
    category: 'other', origin: 'synthetic', typical_uses: ['food', 'cosmetics'],
    plain_explanation: 'Fats with shorter chains than most dietary fat, usually from coconut or palm kernel oil. They stay liquid and are absorbed differently from long-chain fats.',
  },
  // ─── Enzymes and processing aids ───
  {
    id: 'ing_amylase', canonical_name: 'Amylase', aka: ['alpha-amylase', 'fungal amylase', 'enzyme'],
    category: 'other', origin: 'natural',
    plain_explanation: 'An enzyme that breaks starch into sugars. In bread it gives yeast more to feed on and slows staling.',
  },
  {
    id: 'ing_protease', canonical_name: 'Protease', aka: ['proteolytic enzyme', 'papain', 'bromelain'],
    category: 'other', origin: 'natural',
    plain_explanation: 'An enzyme that breaks protein into smaller pieces. It relaxes dough and is used to tenderise meat.',
  },
  {
    id: 'ing_transglutaminase', canonical_name: 'Transglutaminase', aka: ['TG', 'microbial transglutaminase'],
    category: 'other', origin: 'natural',
    plain_explanation: 'An enzyme that links proteins together, used to bind pieces of meat or fish into a single piece and to firm dairy products.',
  },
  {
    id: 'ing_rennet', canonical_name: 'Rennet', aka: ['microbial rennet', 'chymosin', 'vegetable rennet'],
    category: 'other', origin: 'natural',
    plain_explanation: 'The enzyme that curdles milk into cheese. It is taken from calf stomach or, more often now, produced by fermentation.',
  },
  {
    id: 'ing_lactase', canonical_name: 'Lactase', aka: ['beta-galactosidase'],
    category: 'other', origin: 'natural', typical_uses: ['food', 'pharmaceutical'],
    plain_explanation: 'The enzyme that splits lactose into simpler sugars. It is what makes lactose-free milk lactose-free.',
  },
  {
    id: 'ing_propylene_glycol', canonical_name: 'Propylene glycol', aka: ['E1520', '1,2-propanediol'],
    cas_number: '57-55-6', e_number_ins_code: 'E1520', category: 'other', origin: 'synthetic',
    typical_uses: ['food', 'cosmetics', 'pharmaceutical'],
    plain_explanation: 'A liquid that holds moisture and dissolves flavourings. It carries colours and flavours into a product evenly.',
    us: { status: 'Generally Recognized as Safe (GRAS)', cfr: '184.1666' },
    eu: { status: 'Authorised as a carrier solvent for specified uses' },
  },
  {
    id: 'ing_carnauba_wax', canonical_name: 'Carnauba wax', aka: ['E903', 'brazil wax'],
    cas_number: '8015-86-9', e_number_ins_code: 'E903', category: 'other', origin: 'natural',
    typical_uses: ['food', 'cosmetics'],
    plain_explanation: 'A hard wax from palm leaves used as a glaze on sweets and coated tablets.',
    us: { status: 'Generally Recognized as Safe (GRAS)', cfr: '184.1978' },
    eu: { status: 'Authorised glazing agent' },
  },
  {
    id: 'ing_shellac', canonical_name: 'Shellac', aka: ['confectioners glaze', 'E904', 'resinous glaze'],
    cas_number: '9000-59-3', e_number_ins_code: 'E904', category: 'other', origin: 'natural',
    plain_explanation: 'A resin secreted by the lac insect, used as the shiny coating on sweets and some fruit.',
    us: { status: 'Permitted for use as a glaze', cfr: '175.300' },
    eu: { status: 'Authorised glazing agent' },
  },
];
