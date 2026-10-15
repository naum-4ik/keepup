import {
  Bike, BookOpen, BriefcaseBusiness, CalendarCheck, CalendarDays, CalendarRange, CircleCheck, Droplet, Flame, Handshake, Heart, House,
  Leaf, Moon, Mountain, PartyPopper, RotateCcw, Scale, Shield, Sprout, Star, TreePine, Users, Zap, type LucideIcon,
} from "lucide-react";

// Catalog-free, so client components can import it (lib/badges.ts pulls the whole message catalog).
// The 24 badges (ideas/achievements-and-rewards.md §4): lucide line icons in pastel circles, no tiers.
// achievements.icon holds the component name; an unknown one (a newer database) shows a star.
export const BADGE_ICONS: Record<string, LucideIcon> = {
  Bike, BookOpen, BriefcaseBusiness, CalendarCheck, CalendarDays, CalendarRange, CircleCheck, Droplet, Flame, Handshake, Heart, House,
  Leaf, Moon, Mountain, PartyPopper, RotateCcw, Scale, Shield, Sprout, Star, TreePine, Users, Zap,
};
export const badgeIcon = (icon: string): LucideIcon => BADGE_ICONS[icon] ?? Star;
