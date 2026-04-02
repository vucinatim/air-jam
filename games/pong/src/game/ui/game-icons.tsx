import type { IconBaseProps, IconType } from "react-icons";
import {
  GiBoltSpellCast,
  GiBroadsword,
  GiFrozenOrb,
  GiHeartPlus,
  GiLaserBlast,
  GiPoisonBottle,
  GiRadioactive,
  GiShield,
  GiStarSwirl,
  GiUpgrade,
  GiWingfoot,
} from "react-icons/gi";

export type GameIconProps = IconBaseProps;
export type GameIconComponent = IconType;

// Curate gameplay-facing icons behind a local module instead of importing
// directly from react-icons across the codebase.
export const AbilityIcon = GiBoltSpellCast;
export const WeaponIcon = GiBroadsword;
export const FrozenStatusIcon = GiFrozenOrb;
export const HealthIcon = GiHeartPlus;
export const ShieldIcon = GiShield;
export const DamageIcon = GiLaserBlast;
export const PoisonStatusIcon = GiPoisonBottle;
export const RadiationStatusIcon = GiRadioactive;
export const BuffIcon = GiStarSwirl;
export const UpgradeIcon = GiUpgrade;
export const SpeedIcon = GiWingfoot;
