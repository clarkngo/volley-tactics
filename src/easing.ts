import gsap from 'gsap';
import { EasingType } from './types';

const EASE_MAP: Record<EasingType, string> = {
  linear: 'none',
  'power2.inOut': 'power2.inOut',
  'power3.out': 'power3.out',
  'back.inOut': 'back.inOut',
  'elastic.out': 'elastic.out(1, 0.5)',
  'bounce.out': 'bounce.out',
};

const easeFns = new Map<EasingType, (t: number) => number>();

/** Apply GSAP easing to a normalized 0–1 value. */
export function applyEasing(t: number, easing: EasingType): number {
  if (easing === 'linear') return t;
  let fn = easeFns.get(easing);
  if (!fn) {
    fn = gsap.parseEase(EASE_MAP[easing]) as (t: number) => number;
    easeFns.set(easing, fn);
  }
  return fn(t);
}
