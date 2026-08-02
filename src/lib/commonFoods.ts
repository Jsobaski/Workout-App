// A small built-in database of everyday foods with typical calories/protein
// per a standard serving, so common items (banana, eggs, chicken breast...)
// auto-fill instantly with no AI call and no network request. Values are
// reasonable USDA-style approximations for a common serving size — always
// editable before saving since exact values vary by brand/preparation.
export interface CommonFood {
  name: string;
  calories: number;
  proteinG: number;
  servingHint: string;
}

export const COMMON_FOODS: CommonFood[] = [
  { name: "Banana", calories: 105, proteinG: 1.3, servingHint: "1 medium" },
  { name: "Apple", calories: 95, proteinG: 0.5, servingHint: "1 medium" },
  { name: "Orange", calories: 62, proteinG: 1.2, servingHint: "1 medium" },
  { name: "Strawberries", calories: 49, proteinG: 1, servingHint: "1 cup" },
  { name: "Blueberries", calories: 84, proteinG: 1.1, servingHint: "1 cup" },
  { name: "Grapes", calories: 104, proteinG: 1.1, servingHint: "1 cup" },
  { name: "Watermelon", calories: 46, proteinG: 0.9, servingHint: "1 cup" },
  { name: "Pineapple", calories: 82, proteinG: 0.9, servingHint: "1 cup" },
  { name: "Mango", calories: 99, proteinG: 1.4, servingHint: "1 cup" },
  { name: "Avocado", calories: 234, proteinG: 2.9, servingHint: "1 whole" },
  { name: "Egg", calories: 70, proteinG: 6, servingHint: "1 large" },
  { name: "Egg White", calories: 17, proteinG: 3.6, servingHint: "1 large" },
  { name: "Chicken Breast (cooked)", calories: 165, proteinG: 31, servingHint: "100g" },
  { name: "Turkey Breast (cooked)", calories: 135, proteinG: 25, servingHint: "100g" },
  { name: "Ground Beef 90/10 (cooked)", calories: 184, proteinG: 22, servingHint: "100g" },
  { name: "Salmon (cooked)", calories: 206, proteinG: 22, servingHint: "100g" },
  { name: "Tuna (canned in water)", calories: 100, proteinG: 22, servingHint: "3 oz" },
  { name: "Shrimp (cooked)", calories: 84, proteinG: 18, servingHint: "3 oz" },
  { name: "Pork Chop (cooked)", calories: 231, proteinG: 23, servingHint: "100g" },
  { name: "Bacon", calories: 43, proteinG: 3, servingHint: "1 slice" },
  { name: "Tofu (firm)", calories: 94, proteinG: 10, servingHint: "1/2 cup" },
  { name: "Greek Yogurt (plain, nonfat)", calories: 100, proteinG: 17, servingHint: "170g (6oz)" },
  { name: "Cottage Cheese (low-fat)", calories: 81, proteinG: 11, servingHint: "1/2 cup" },
  { name: "Whole Milk", calories: 149, proteinG: 8, servingHint: "1 cup" },
  { name: "Skim Milk", calories: 83, proteinG: 8, servingHint: "1 cup" },
  { name: "Almond Milk (unsweetened)", calories: 30, proteinG: 1, servingHint: "1 cup" },
  { name: "Cheddar Cheese", calories: 113, proteinG: 7, servingHint: "1 oz" },
  { name: "Mozzarella Cheese", calories: 85, proteinG: 6, servingHint: "1 oz" },
  { name: "Whey Protein Powder", calories: 120, proteinG: 24, servingHint: "1 scoop" },
  { name: "Protein Bar", calories: 200, proteinG: 20, servingHint: "1 bar (avg)" },
  { name: "White Rice (cooked)", calories: 205, proteinG: 4.3, servingHint: "1 cup" },
  { name: "Brown Rice (cooked)", calories: 216, proteinG: 5, servingHint: "1 cup" },
  { name: "Oatmeal (cooked)", calories: 158, proteinG: 6, servingHint: "1 cup" },
  { name: "Quinoa (cooked)", calories: 222, proteinG: 8, servingHint: "1 cup" },
  { name: "Pasta (cooked)", calories: 221, proteinG: 8, servingHint: "1 cup" },
  { name: "Bread (whole wheat)", calories: 81, proteinG: 4, servingHint: "1 slice" },
  { name: "Bread (white)", calories: 75, proteinG: 2.6, servingHint: "1 slice" },
  { name: "Potato (baked)", calories: 161, proteinG: 4.3, servingHint: "1 medium" },
  { name: "Sweet Potato (baked)", calories: 112, proteinG: 2, servingHint: "1 medium" },
  { name: "Black Beans (cooked)", calories: 227, proteinG: 15, servingHint: "1 cup" },
  { name: "Chickpeas (cooked)", calories: 269, proteinG: 15, servingHint: "1 cup" },
  { name: "Lentils (cooked)", calories: 230, proteinG: 18, servingHint: "1 cup" },
  { name: "Broccoli", calories: 55, proteinG: 3.7, servingHint: "1 cup chopped" },
  { name: "Spinach", calories: 7, proteinG: 0.9, servingHint: "1 cup raw" },
  { name: "Carrots", calories: 52, proteinG: 1.2, servingHint: "1 cup chopped" },
  { name: "Tomato", calories: 22, proteinG: 1.1, servingHint: "1 medium" },
  { name: "Cucumber", calories: 16, proteinG: 0.7, servingHint: "1 cup sliced" },
  { name: "Bell Pepper", calories: 24, proteinG: 1, servingHint: "1 medium" },
  { name: "Onion", calories: 44, proteinG: 1.2, servingHint: "1 medium" },
  { name: "Corn", calories: 132, proteinG: 5, servingHint: "1 cup" },
  { name: "Green Beans", calories: 31, proteinG: 1.8, servingHint: "1 cup" },
  { name: "Zucchini", calories: 20, proteinG: 1.5, servingHint: "1 cup sliced" },
  { name: "Almonds", calories: 164, proteinG: 6, servingHint: "1 oz (23 almonds)" },
  { name: "Walnuts", calories: 185, proteinG: 4.3, servingHint: "1 oz" },
  { name: "Peanut Butter", calories: 190, proteinG: 8, servingHint: "2 tbsp" },
  { name: "Hummus", calories: 25, proteinG: 1.2, servingHint: "1 tbsp" },
  { name: "Butter", calories: 102, proteinG: 0.1, servingHint: "1 tbsp" },
  { name: "Olive Oil", calories: 119, proteinG: 0, servingHint: "1 tbsp" },
];

export function findCommonFood(name: string): CommonFood | undefined {
  const target = name.trim().toLowerCase();
  return COMMON_FOODS.find((f) => f.name.toLowerCase() === target);
}
