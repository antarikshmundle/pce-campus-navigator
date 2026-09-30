import {
  BedDouble,
  BookOpen,
  Building,
  FlaskConical,
  GraduationCap,
  Landmark,
  MapPin,
  Trophy,
  Utensils,
} from 'lucide-react'

/**
 * Visual metadata per backend category. Categories are admin-editable free
 * text, so anything unknown falls back to DEFAULT_META rather than breaking.
 */
const CATEGORY_META = {
  academic: { icon: GraduationCap, label: 'Academic' },
  admin: { icon: Building, label: 'Admin' },
  landmark: { icon: Landmark, label: 'Landmarks' },
  sports: { icon: Trophy, label: 'Sports' },
  hostel: { icon: BedDouble, label: 'Hostels' },
  lab: { icon: FlaskConical, label: 'Labs' },
  library: { icon: BookOpen, label: 'Library' },
  food: { icon: Utensils, label: 'Food' },
  canteen: { icon: Utensils, label: 'Canteen' },
}

const DEFAULT_KEY = 'default'
const DEFAULT_META = { icon: MapPin, label: null }

/** `key` identifies the icon (used for map marker images); `label` is display text. */
export function getCategoryMeta(category = '') {
  const lookup = category.toLowerCase()
  const known = CATEGORY_META[lookup]
  const meta = known || DEFAULT_META
  return { ...meta, key: known ? lookup : DEFAULT_KEY, label: meta.label || category }
}

/** Every distinct icon, keyed — lets the map pre-render one marker image per key. */
export function listCategoryIcons() {
  return [...Object.entries(CATEGORY_META).map(([key, m]) => [key, m.icon]), [DEFAULT_KEY, DEFAULT_META.icon]]
}
