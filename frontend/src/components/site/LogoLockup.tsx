import { LOGOS } from '../../assets/site';

/**
 * Both seals overlapped, RCCG in front. Decorative here: wherever it appears the
 * words "Faith Tribe" sit next to it, so an alt would only make a screen reader
 * say the name twice.
 */
const LogoLockup = () => (
  <span aria-hidden className="isolate flex shrink-0 items-start">
    <img
      src={LOGOS.rccg}
      alt=""
      width={44}
      height={44}
      className="relative z-[2] -mr-3 size-11 object-contain"
    />
    <img
      src={LOGOS.faithTribe}
      alt=""
      width={44}
      height={44}
      className="relative z-[1] size-11 object-contain"
    />
  </span>
);

export default LogoLockup;
