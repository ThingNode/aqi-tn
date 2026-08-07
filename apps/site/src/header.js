/* The bar sits transparent over the full-bleed hero and picks up its cream
 * background once the hero has scrolled past it. An observer on the hero is
 * cheaper than a scroll listener, and the negative top margin is the bar's own
 * height, so the swap lands exactly as the hero's bottom edge passes under it.
 */
const bar = document.querySelector('.bar');
const hero = document.querySelector('.hero');

if (bar && hero && 'IntersectionObserver' in window) {
  const barHeight = () => Math.round(bar.getBoundingClientRect().height);

  let observer;
  const watch = () => {
    observer?.disconnect();
    observer = new IntersectionObserver(
      ([entry]) => bar.classList.toggle('is-solid', !entry.isIntersecting),
      { rootMargin: `-${barHeight()}px 0px 0px 0px` }
    );
    observer.observe(hero);
  };

  watch();
  // The bar's height changes at the 560px breakpoint, so the margin is re-read.
  window.addEventListener('resize', watch, { passive: true });
} else {
  // No observer: the readable state is the safe one.
  bar?.classList.add('is-solid');
}
