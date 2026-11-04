const PICKUP_SLOTS = [
  { id: "short-break", label: "11:00 AM · Short break" },
  { id: "lunch-break", label: "12:30 PM · Lunch break" },
  { id: "late-lunch", label: "1:15 PM · Late lunch" },
  { id: "evening-snack", label: "4:45 PM · Evening snack" },
  { id: "night-canteen", label: "8:30 PM · Night canteen" }
];

const MENU_CATALOG = {
  "central-food-court": {
    name: "Central Food Court",
    location: "Block C · Near Lecture Hall 1",
    pickupLocation: "Counter 3 · Central Food Court",
    description: "Campus favourites made fresh for your next break.",
    items: [
      { id: "chicken-biryani", name: "Chicken Biryani", price: 149, icon: "🍛", description: "Fragrant basmati rice with spiced chicken and fresh herbs." },
      { id: "veg-pizza", name: "Veg Pizza", price: 159, icon: "🍕", description: "A crisp, cheesy pizza topped with garden vegetables." },
      { id: "paneer-wrap", name: "Paneer Wrap", price: 99, icon: "🌯", description: "Soft wrap filled with paneer, crunchy vegetables, and house sauce." }
    ]
  },
  "hostel-mess-cafe": {
    name: "Hostel Mess Cafe",
    location: "Hostel block · By the common room",
    pickupLocation: "Counter 1 · Hostel Mess Cafe",
    description: "Comforting meals and quick bites close to your hostel.",
    items: [
      { id: "paneer-butter-masala", name: "Paneer Butter Masala", price: 129, icon: "🍲", description: "Soft paneer in a rich, creamy tomato gravy." },
      { id: "hakka-chowmein", name: "Hakka Chowmein", price: 119, icon: "🍜", description: "Wok-tossed noodles with crunchy vegetables and sauces." },
      { id: "masala-dosa", name: "Masala Dosa", price: 89, icon: "🥞", description: "Golden, crisp dosa served with a warmly spiced potato filling." }
    ]
  },
  "library-snack-bar": {
    name: "Library Snack Bar",
    location: "Beside the reading hall",
    pickupLocation: "Counter 2 · Library Snack Bar",
    description: "Quick bites and a little pick-me-up between study sessions.",
    items: [
      { id: "chicken-burger", name: "Chicken Burger", price: 99, icon: "🍔", description: "Crispy chicken, fresh vegetables, and our house sauce." },
      { id: "chicken-roll", name: "Chicken Roll", price: 89, icon: "🌯", description: "Grilled chicken wrapped in a soft paratha with onions." },
      { id: "cold-coffee", name: "Cold Coffee", price: 69, icon: "🧋", description: "Chilled, creamy coffee to keep your study break cool." }
    ]
  },
  "north-block-canteen": {
    name: "North Block Canteen",
    location: "North academic block · Ground floor",
    pickupLocation: "Counter 4 · North Block Canteen",
    description: "A satisfying stop just steps away from your next class.",
    items: [
      { id: "chole-bhature", name: "Chole Bhature", price: 99, icon: "🫓", description: "Spiced chickpeas with fluffy, golden-fried bhature." },
      { id: "veg-grilled-sandwich", name: "Veg Grilled Sandwich", price: 79, icon: "🥪", description: "Grilled bread layered with vegetables and melty cheese." },
      { id: "paneer-tikka-roll", name: "Paneer Tikka Roll", price: 109, icon: "🌯", description: "Smoky paneer tikka wrapped with crisp salad and chutney." }
    ]
  },
  "south-campus-cafe": {
    name: "South Campus Cafe",
    location: "South campus courtyard · Across from Block D",
    pickupLocation: "Counter 1 · South Campus Cafe",
    description: "Freshly prepared cafe classics for a laid-back campus break.",
    items: [
      { id: "veg-hakka-noodles", name: "Veg Hakka Noodles", price: 109, icon: "🍜", description: "Stir-fried noodles tossed with fresh vegetables." },
      { id: "margherita-pizza", name: "Margherita Pizza", price: 139, icon: "🍕", description: "A simple classic with tomato, mozzarella, and herbs." },
      { id: "french-fries", name: "French Fries", price: 69, icon: "🍟", description: "Crispy golden fries, perfect for sharing or keeping." }
    ]
  },
  "coffee-and-co": {
    name: "Coffee & Co.",
    location: "Student activity centre · Next to the auditorium",
    pickupLocation: "Counter 2 · Coffee & Co.",
    description: "Coffee, bakery treats, and a cosy pause in your day.",
    items: [
      { id: "cappuccino", name: "Cappuccino", price: 89, icon: "☕", description: "Freshly brewed espresso topped with silky steamed milk." },
      { id: "chocolate-brownie", name: "Chocolate Brownie", price: 79, icon: "🍫", description: "A rich, fudgy chocolate treat for your coffee break." },
      { id: "veg-puff", name: "Veg Puff", price: 35, icon: "🥐", description: "Flaky pastry filled with a savoury vegetable mix." }
    ]
  }
};

module.exports = { MENU_CATALOG, PICKUP_SLOTS };
