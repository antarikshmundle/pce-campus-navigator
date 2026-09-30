import {
  Banknote,
  BedDouble,
  Building2,
  Bus,
  CarTaxiFront,
  Coffee,
  Cross,
  Fuel,
  Landmark,
  LayoutGrid,
  Mailbox,
  MapPin,
  Microscope,
  Pill,
  Printer,
  Shield,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  Stethoscope,
  Theater,
  Trees,
  TrainFront,
  TramFront,
  Utensils,
  Waves,
  Castle,
  Church,
  PencilRuler,
  Ticket,
} from 'lucide-react'

/**
 * Central category system for places outside campus. Campus places keep
 * their own categories (features/locations/categoryMeta.js).
 *
 * Every category: stable `id`, `label`, Lucide `icon`, `group`, `layer`
 * ('around' = around PCE, 'nagpur' = city attractions). Provider mappings
 * live with each provider (providers/osm.js), keyed by these ids.
 */
export const NEARBY_CATEGORIES = {
  // Transport
  metro: { label: 'Metro', icon: TramFront, group: 'transport', layer: 'around' },
  bus: { label: 'Bus', icon: Bus, group: 'transport', layer: 'around' },
  taxi: { label: 'Auto / cab', icon: CarTaxiFront, group: 'transport', layer: 'around' },
  railway: { label: 'Railway', icon: TrainFront, group: 'transport', layer: 'around' },
  // Food
  restaurant: { label: 'Restaurant', icon: Utensils, group: 'food', layer: 'around' },
  fastfood: { label: 'Fast food', icon: Utensils, group: 'food', layer: 'around' },
  cafe: { label: 'Café', icon: Coffee, group: 'food', layer: 'around' },
  // Health
  hospital: { label: 'Hospital', icon: Cross, group: 'health', layer: 'around' },
  clinic: { label: 'Clinic', icon: Stethoscope, group: 'health', layer: 'around' },
  pharmacy: { label: 'Pharmacy', icon: Pill, group: 'health', layer: 'around' },
  diagnostic: { label: 'Diagnostics', icon: Microscope, group: 'health', layer: 'around' },
  // Money
  atm: { label: 'ATM', icon: Banknote, group: 'money', layer: 'around' },
  bank: { label: 'Bank', icon: Landmark, group: 'money', layer: 'around' },
  // Shopping / daily needs
  grocery: { label: 'Grocery', icon: ShoppingBasket, group: 'shopping', layer: 'around' },
  stationery: { label: 'Stationery', icon: PencilRuler, group: 'shopping', layer: 'around' },
  printing: { label: 'Printing', icon: Printer, group: 'shopping', layer: 'around' },
  electronics: { label: 'Mobile & electronics', icon: Smartphone, group: 'shopping', layer: 'around' },
  shop: { label: 'Shopping', icon: ShoppingBag, group: 'shopping', layer: 'around' },
  // Services / stay
  petrol: { label: 'Petrol pump', icon: Fuel, group: 'services', layer: 'around' },
  hotel: { label: 'Hotel', icon: BedDouble, group: 'stay', layer: 'around' },
  hostel: { label: 'Hostel', icon: Building2, group: 'stay', layer: 'around' },
  police: { label: 'Police', icon: Shield, group: 'services', layer: 'around' },
  postoffice: { label: 'Post office', icon: Mailbox, group: 'services', layer: 'around' },
  // Explore Nagpur
  attraction: { label: 'Attraction', icon: Ticket, group: 'explore', layer: 'nagpur' },
  park: { label: 'Park', icon: Trees, group: 'explore', layer: 'nagpur' },
  lake: { label: 'Lake', icon: Waves, group: 'explore', layer: 'nagpur' },
  museum: { label: 'Museum', icon: Theater, group: 'explore', layer: 'nagpur' },
  landmark: { label: 'Landmark', icon: Castle, group: 'explore', layer: 'nagpur' },
  worship: { label: 'Place of worship', icon: Church, group: 'explore', layer: 'nagpur' },
  entertainment: { label: 'Shopping & fun', icon: ShoppingBag, group: 'explore', layer: 'nagpur' },
}

const FALLBACK = { label: 'Place', icon: MapPin, group: 'other', layer: 'around' }

export function getNearbyCategory(id) {
  return { id, ...(NEARBY_CATEGORIES[id] ?? FALLBACK) }
}

/**
 * Filter chips per layer. A chip matches a set of category ids; chips with
 * no matching places are hidden by the screen.
 */
const chip = (id, label, icon, categories) => ({ id, label, icon, categories })
export const NEARBY_CHIPS = {
  around: [
    chip('all', 'All', LayoutGrid, null),
    chip('metro', 'Metro', TramFront, ['metro']),
    chip('transport', 'Transport', Bus, ['bus', 'taxi', 'railway', 'metro']),
    chip('food', 'Food', Utensils, ['restaurant', 'fastfood', 'cafe']),
    chip('cafe', 'Café', Coffee, ['cafe']),
    chip('hospital', 'Hospital', Cross, ['hospital', 'clinic', 'diagnostic']),
    chip('pharmacy', 'Pharmacy', Pill, ['pharmacy']),
    chip('atm', 'ATM & bank', Banknote, ['atm', 'bank']),
    chip('shopping', 'Shopping', ShoppingBag, ['grocery', 'stationery', 'printing', 'electronics', 'shop']),
    chip('printing', 'Printing', Printer, ['printing', 'stationery']),
    chip('petrol', 'Petrol', Fuel, ['petrol']),
    chip('stay', 'Stay', BedDouble, ['hotel', 'hostel']),
    chip('services', 'Police & services', Shield, ['police', 'postoffice']),
  ],
  nagpur: [
    chip('all', 'All', LayoutGrid, null),
    chip('attraction', 'Attractions', Ticket, ['attraction', 'landmark']),
    chip('park', 'Parks', Trees, ['park']),
    chip('lake', 'Lakes', Waves, ['lake']),
    chip('museum', 'Museums', Theater, ['museum']),
    chip('worship', 'Places of worship', Church, ['worship']),
    chip('entertainment', 'Shopping & fun', ShoppingBag, ['entertainment']),
  ],
}

/** Every icon, keyed — lets the map pre-render one marker image per category. */
export function listNearbyCategoryIcons() {
  return [...Object.entries(NEARBY_CATEGORIES).map(([id, c]) => [id, c.icon]), ['other', FALLBACK.icon]]
}
