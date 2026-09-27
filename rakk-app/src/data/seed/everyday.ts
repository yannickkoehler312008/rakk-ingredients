/**
 * THE EVERYDAY ALLOW-LIST — §3.
 *
 * "An ingredient is flagged if it is NOT in a small allow-list of ~40–60
 *  everyday kitchen ingredients (salt, water, sugar, flour, yeast, common oils,
 *  common spices, etc.) AND it has a matching entry in the ingredients
 *  database. Anything matched but not flagged still shows in the list, just
 *  unstyled/muted."
 *
 * §3 says "config this, don't hardcode": the rule lives in one place (the
 * `everyday: true` field), the matcher reads it as data, and no screen knows
 * this list exists. Adding or removing an entry here changes behaviour with no
 * code change anywhere else.
 *
 * These also form the base of §8's offline-bundled subset.
 *
 * The bar for inclusion: would an ordinary shopper reading the label already
 * know what this is? If yes, flagging it is noise.
 */
import { SeedIngredient } from './types';

/** Shared by every entry below — these are foods, not additives. */
const everyday = (
  id: string,
  canonical_name: string,
  plain_explanation: string,
  extra: Partial<SeedIngredient> = {},
): SeedIngredient => ({
  id,
  canonical_name,
  category: 'other',
  origin: 'natural',
  plain_explanation,
  everyday: true,
  ...extra,
});

export const EVERYDAY: SeedIngredient[] = [
  // ─── The basics ───
  everyday('ing_water', 'Water', 'Water, used as the base or solvent for the other ingredients.', {
    aka: ['aqua', 'carbonated water', 'filtered water', 'purified water', 'sparkling water'],
    cas_number: '7732-18-5', chemical_formula: 'H2O', typical_uses: ['food', 'cosmetics', 'pharmaceutical'],
  }),
  everyday('ing_salt', 'Salt', 'Salt, used for flavour and, in some products, to slow spoilage.', {
    aka: ['sodium chloride', 'sea salt', 'table salt', 'iodized salt', 'kosher salt'],
    cas_number: '7647-14-5', chemical_formula: 'NaCl',
  }),
  everyday('ing_sugar', 'Sugar', 'Table sugar, used to sweeten.', {
    aka: ['cane sugar', 'sucrose', 'granulated sugar', 'organic cane sugar', 'beet sugar', 'raw sugar', 'brown sugar', 'cane juice'],
    cas_number: '57-50-1', chemical_formula: 'C12H22O11', category: 'sweetener',
  }),
  everyday('ing_wheat_flour', 'Wheat flour', 'Milled wheat, the main structure of most baked goods.', {
    aka: ['enriched wheat flour', 'flour', 'enriched flour', 'whole wheat flour', 'bleached flour', 'unbleached flour', 'all purpose flour'],
    allergen_flags: ['wheat'],
  }),
  everyday('ing_yeast', 'Yeast', 'Baker’s yeast, which ferments sugars and makes dough rise.', {
    aka: ['bakers yeast', 'active dry yeast', 'instant yeast', 'saccharomyces cerevisiae'],
  }),
  everyday('ing_baking_powder', 'Baking powder', 'A ready-mixed leavener: baking soda plus a dry acid, so it only needs liquid to work.', {
    category: 'leavening_agent',
  }),
  everyday('ing_vinegar', 'Vinegar', 'Fermented alcohol, used for sourness and to slow spoilage.', {
    aka: ['white vinegar', 'distilled vinegar', 'apple cider vinegar', 'white distilled vinegar'],
  }),
  everyday('ing_honey', 'Honey', 'Honey, used to sweeten and to hold moisture.', {
    cas_number: '8028-66-8', category: 'sweetener',
  }),
  everyday('ing_maple_syrup', 'Maple syrup', 'Boiled-down maple sap, used to sweeten.', {
    aka: ['pure maple syrup'], category: 'sweetener',
  }),

  // ─── Grains and staples ───
  everyday('ing_oats', 'Whole grain oats', 'Whole oat grains.', {
    aka: ['rolled oats', 'oats', 'oat flour', 'whole oats', 'steel cut oats'],
  }),
  everyday('ing_rice', 'Rice', 'Rice grain.', { aka: ['white rice', 'brown rice', 'long grain rice'] }),
  everyday('ing_corn', 'Corn', 'Corn kernels or meal.', { aka: ['whole grain corn', 'corn meal', 'cornmeal', 'yellow corn', 'masa'] }),
  everyday('ing_barley', 'Barley', 'Barley grain.', { aka: ['malted barley', 'pearl barley', 'barley flour'], allergen_flags: ['wheat'] }),
  everyday('ing_potatoes', 'Potatoes', 'Potato.', { aka: ['potato', 'dried potatoes', 'potato flakes'] }),
  everyday('ing_tomatoes', 'Tomatoes', 'Tomato.', { aka: ['tomato', 'tomato paste', 'tomato puree', 'crushed tomatoes', 'diced tomatoes'] }),

  // ─── Dairy and eggs ───
  everyday('ing_milk', 'Milk', 'Cow’s milk.', {
    aka: ['whole milk', 'skim milk', 'nonfat milk', 'milk solids', 'skimmed milk powder', 'nonfat dry milk', 'milkfat'],
    allergen_flags: ['milk'],
  }),
  everyday('ing_butter', 'Butter', 'Churned cream.', { aka: ['sweet cream butter', 'unsalted butter'], allergen_flags: ['milk'] }),
  everyday('ing_cream', 'Cream', 'The fat-rich part of milk.', { aka: ['heavy cream', 'light cream'], allergen_flags: ['milk'] }),
  everyday('ing_cheese', 'Cheese', 'Cheese.', { aka: ['cheddar cheese', 'parmesan cheese', 'mozzarella'], allergen_flags: ['milk'] }),
  everyday('ing_yogurt', 'Yogurt', 'Milk fermented with bacterial cultures.', { aka: ['yoghurt', 'cultured milk'], allergen_flags: ['milk'] }),
  everyday('ing_eggs', 'Eggs', 'Hen’s egg.', { aka: ['egg', 'whole eggs', 'egg whites', 'egg yolks', 'dried egg whites'], allergen_flags: ['egg'] }),

  // ─── Common oils and fats ───
  everyday('ing_olive_oil', 'Olive oil', 'Oil pressed from olives.', { aka: ['extra virgin olive oil', 'virgin olive oil'] }),
  everyday('ing_sunflower_oil', 'Sunflower oil', 'Oil pressed from sunflower seeds.', {
    aka: ['sunflower seed oil', 'high oleic sunflower oil'], cas_number: '8001-21-6',
  }),
  everyday('ing_vegetable_oil', 'Vegetable oil', 'A blend of refined plant oils.', { aka: ['vegetable oils'] }),

  // ─── Nuts, seeds, legumes ───
  everyday('ing_almonds', 'Almonds', 'Almonds.', {
    aka: ['almond', 'dry roasted almonds', 'roasted almonds', 'almond flour'], allergen_flags: ['tree_nut'],
  }),
  everyday('ing_peanuts', 'Peanuts', 'Peanuts.', {
    aka: ['peanut', 'roasted peanuts', 'peanut butter'], allergen_flags: ['peanut'],
  }),
  everyday('ing_cashews', 'Cashews', 'Cashew nuts.', { aka: ['cashew'], allergen_flags: ['tree_nut'] }),
  everyday('ing_walnuts', 'Walnuts', 'Walnuts.', { aka: ['walnut'], allergen_flags: ['tree_nut'] }),
  everyday('ing_hazelnuts', 'Hazelnuts', 'Hazelnuts.', { aka: ['hazelnut', 'filberts'], allergen_flags: ['tree_nut'] }),
  everyday('ing_sesame', 'Sesame seeds', 'Sesame seeds.', { aka: ['sesame', 'sesame seed', 'tahini'], allergen_flags: ['sesame'] }),
  everyday('ing_sunflower_seeds', 'Sunflower seeds', 'Sunflower seeds.', { aka: ['sunflower seed'] }),
  everyday('ing_soybeans', 'Soybeans', 'Soybeans.', { aka: ['soybean', 'soya beans', 'edamame'], allergen_flags: ['soybean'] }),
  everyday('ing_chickpeas', 'Chickpeas', 'Chickpeas.', { aka: ['garbanzo beans', 'chickpea flour'] }),

  // ─── Cocoa, coffee, tea ───
  everyday('ing_cocoa', 'Cocoa', 'Ground cocoa beans.', {
    aka: ['cocoa powder', 'cocoa solids', 'cacao', 'chocolate liquor', 'unsweetened chocolate', 'fat reduced cocoa'],
  }),
  everyday('ing_coffee', 'Coffee', 'Roasted coffee beans or their extract.', { aka: ['coffee extract', 'instant coffee', 'ground coffee'] }),
  everyday('ing_tea', 'Tea', 'Tea leaves or their extract.', { aka: ['green tea', 'black tea', 'tea extract'] }),

  // ─── Common spices and aromatics ───
  everyday('ing_spices', 'Spices', 'A collective term for ground spices, not itemised individually on the label.', { aka: ['spice', 'ground spices'] }),
  everyday('ing_black_pepper', 'Black pepper', 'Ground black peppercorns.', { aka: ['pepper', 'ground black pepper'] }),
  everyday('ing_cinnamon', 'Cinnamon', 'Ground cinnamon bark.', { aka: ['ground cinnamon'] }),
  everyday('ing_garlic', 'Garlic', 'Garlic.', { aka: ['garlic powder', 'dried garlic', 'granulated garlic'] }),
  everyday('ing_onion', 'Onion', 'Onion.', { aka: ['onion powder', 'dried onion', 'onions'] }),
  everyday('ing_paprika', 'Paprika', 'Ground sweet peppers.', { aka: ['ground paprika'] }),
  everyday('ing_ginger', 'Ginger', 'Ginger root.', { aka: ['ground ginger', 'dried ginger'] }),
  everyday('ing_nutmeg', 'Nutmeg', 'Ground nutmeg.', {}),
  everyday('ing_cumin', 'Cumin', 'Cumin seed, whole or ground.', {}),
  everyday('ing_chili_pepper', 'Chili pepper', 'Dried chilli.', { aka: ['chili', 'chilli', 'red pepper', 'cayenne pepper', 'chili powder'] }),
  everyday('ing_oregano', 'Oregano', 'Dried oregano leaf.', {}),
  everyday('ing_basil', 'Basil', 'Basil leaf.', {}),
  everyday('ing_rosemary', 'Rosemary', 'Rosemary leaf.', {}),
  everyday('ing_vanilla', 'Vanilla', 'Vanilla bean or its extract.', { aka: ['vanilla extract', 'vanilla bean', 'ground vanilla'] }),
  everyday('ing_mustard', 'Mustard', 'Mustard seed or prepared mustard.', { aka: ['mustard seed', 'mustard flour', 'dry mustard'] }),

  // ─── Common fruits and vegetables on labels ───
  everyday('ing_apples', 'Apples', 'Apple.', { aka: ['apple', 'apple juice concentrate', 'apple puree'] }),
  everyday('ing_carrots', 'Carrots', 'Carrot.', { aka: ['carrot', 'carrot juice'] }),
  everyday('ing_strawberries', 'Strawberries', 'Strawberry.', { aka: ['strawberry'] }),
  everyday('ing_bananas', 'Bananas', 'Banana.', { aka: ['banana', 'banana puree'] }),
  everyday('ing_blueberries', 'Blueberries', 'Blueberry.', { aka: ['blueberry'] }),
  everyday('ing_raisins', 'Raisins', 'Dried grapes.', { aka: ['raisin', 'sultanas'] }),
  everyday('ing_coconut', 'Coconut', 'Coconut flesh.', { aka: ['shredded coconut', 'desiccated coconut', 'coconut milk'] }),
  everyday('ing_lemon_juice', 'Lemon juice', 'Juice from lemons.', { aka: ['lemon juice concentrate', 'lemon'] }),
  everyday('ing_orange_juice', 'Orange juice', 'Juice from oranges.', { aka: ['orange juice concentrate', 'orange'] }),

  // ─── Kitchen staples an ordinary shopper already knows ───
  everyday('ing_corn_starch', 'Corn starch', 'Starch from the corn kernel, used to thicken.', {
    aka: ['cornstarch', 'maize starch'], cas_number: '9005-25-8', category: 'thickener',
  }),
  everyday('ing_potato_starch', 'Potato starch', 'Starch from potatoes, used to thicken.', {
    aka: ['potato flour'], category: 'thickener',
  }),
  everyday('ing_tapioca_starch', 'Tapioca starch', 'Starch from the cassava root, used to thicken.', {
    aka: ['tapioca flour', 'cassava starch'], category: 'thickener',
  }),
  everyday('ing_rice_flour', 'Rice flour', 'Finely ground rice.', {
    aka: ['white rice flour', 'brown rice flour'],
  }),
  everyday('ing_molasses', 'Molasses', 'The dark syrup left after sugar crystals are removed from cane juice.', {
    aka: ['blackstrap molasses', 'cane molasses'], category: 'sweetener',
  }),
  everyday('ing_maltose', 'Maltose', 'A sugar made of two glucose units, produced when starch is broken down.', {
    aka: ['malt sugar'], cas_number: '69-79-4', category: 'sweetener',
  }),
  everyday('ing_cocoa_butter', 'Cocoa butter', 'The fat pressed from cocoa beans.', {
    aka: ['theobroma oil'],
  }),
  everyday('ing_coconut_oil', 'Coconut oil', 'Oil from coconut flesh.', {
    aka: ['fractionated coconut oil', 'copra oil'], cas_number: '8001-31-8',
  }),
  everyday('ing_canola_oil', 'Canola oil', 'Oil from a variety of rapeseed bred for low erucic acid.', {
    aka: ['rapeseed oil', 'low erucic acid rapeseed oil'],
  }),

  // ─── Familiar nutrient names ───
  // Labels gloss a chemical with the name everyone knows: "Vitamin C (sodium
  // ascorbate)", "Vitamin E (mixed tocopherols)". Flagging BOTH halves put an
  // underline under almost every word of a fortified cereal label, which made
  // the underline carry no information. The familiar half sits here; the
  // chemical form stays flaggable, because that is the half worth explaining.
  everyday('ing_name_vitamin_a', 'Vitamin A', 'Vitamin A. The specific form used is usually named in brackets beside it.', {}),
  everyday('ing_name_vitamin_b1', 'Vitamin B1', 'Vitamin B1, also called thiamin.', { aka: ['thiamin', 'thiamine'] }),
  everyday('ing_name_vitamin_b2', 'Vitamin B2', 'Vitamin B2, also called riboflavin.', {}),
  everyday('ing_name_vitamin_b3', 'Vitamin B3', 'Vitamin B3, also called niacin.', { aka: ['niacin'] }),
  everyday('ing_name_vitamin_b5', 'Vitamin B5', 'Vitamin B5, also called pantothenic acid.', {}),
  everyday('ing_name_vitamin_b6', 'Vitamin B6', 'Vitamin B6. The specific form used is usually named in brackets beside it.', {}),
  everyday('ing_name_vitamin_b7', 'Vitamin B7', 'Vitamin B7, also called biotin.', {}),
  everyday('ing_name_vitamin_b9', 'Vitamin B9', 'Vitamin B9, also called folate or folic acid.', {}),
  everyday('ing_name_vitamin_b12', 'Vitamin B12', 'Vitamin B12. The specific form used is usually named in brackets beside it.', {}),
  everyday('ing_name_vitamin_c', 'Vitamin C', 'Vitamin C. The specific form used is usually named in brackets beside it.', {}),
  everyday('ing_name_vitamin_d', 'Vitamin D', 'Vitamin D. The specific form used is usually named in brackets beside it.', {
    aka: ['vitamin d3', 'vitamin d2'],
  }),
  everyday('ing_name_vitamin_e', 'Vitamin E', 'Vitamin E. The specific form used is usually named in brackets beside it.', {}),
  everyday('ing_name_vitamin_k', 'Vitamin K', 'Vitamin K. The specific form used is usually named in brackets beside it.', {}),

  // Bare mineral names, for the same reason. A longer chemical name always
  // wins the match first, so "zinc oxide" is still flagged while "zinc" is not.
  everyday('ing_name_iron', 'Iron', 'Iron, added to fortify the product.', {}),
  everyday('ing_name_zinc', 'Zinc', 'Zinc, added to fortify the product.', {}),
  everyday('ing_name_calcium', 'Calcium', 'Calcium, added to fortify the product.', {}),
  everyday('ing_name_magnesium', 'Magnesium', 'Magnesium, added to fortify the product.', {}),
  everyday('ing_name_potassium', 'Potassium', 'Potassium, added to fortify the product.', {}),
  everyday('ing_name_copper', 'Copper', 'Copper, added in trace amounts to fortify the product.', {}),
  everyday('ing_name_manganese', 'Manganese', 'Manganese, added in trace amounts to fortify the product.', {}),
  everyday('ing_name_selenium', 'Selenium', 'Selenium, added in trace amounts to fortify the product.', {}),
  everyday('ing_name_iodine', 'Iodine', 'Iodine, added to fortify the product.', {}),
];
